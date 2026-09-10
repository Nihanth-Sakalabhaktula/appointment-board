import { Router, type IRouter } from "express";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import {
  CancelAppointmentParams,
  CancelAppointmentResponse,
  CompleteAppointmentParams,
  CompleteAppointmentResponse,
  CreateAppointmentBody,
  CreateAppointmentResponse,
  GetAppointmentSummaryResponse,
  ListAppointmentsQueryParams,
  ListAppointmentsResponse,
  UpdateAppointmentBody,
  UpdateAppointmentParams,
  UpdateAppointmentResponse,
} from "@workspace/api-zod";
import { db, appointmentsTable } from "@workspace/db";

const router: IRouter = Router();

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toApiAppointment(appointment: typeof appointmentsTable.$inferSelect) {
  return {
    id: appointment.id,
    title: appointment.title,
    description: appointment.description,
    date: appointment.scheduledDate,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    status: appointment.status,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}

async function hasTimeConflict(
  date: string,
  startTime: string,
  endTime: string,
  excludeId?: number,
): Promise<boolean> {
  const conditions = [
    eq(appointmentsTable.scheduledDate, date),
    ne(appointmentsTable.status, "cancelled"),
    sql`${appointmentsTable.startTime} < ${endTime}`,
    sql`${appointmentsTable.endTime} > ${startTime}`,
  ];

  if (excludeId !== undefined) {
    conditions.push(ne(appointmentsTable.id, excludeId));
  }

  const [conflict] = await db
    .select({ id: appointmentsTable.id })
    .from(appointmentsTable)
    .where(and(...conditions))
    .limit(1);

  return conflict !== undefined;
}

function validateTimeRange(startTime: string, endTime: string): string | null {
  if (endTime <= startTime) {
    return "End time must be after start time.";
  }

  return null;
}

router.get("/appointments", async (req, res): Promise<void> => {
  const rawDate = typeof req.query.date === "string" ? req.query.date : undefined;
  const parsed = ListAppointmentsQueryParams.safeParse({
    date: rawDate ? new Date(`${rawDate}T00:00:00.000Z`) : undefined,
    status: req.query.status,
  });

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = [];
  if (parsed.data.date) {
    conditions.push(
      eq(appointmentsTable.scheduledDate, toDateString(parsed.data.date)),
    );
  }
  if (parsed.data.status) {
    conditions.push(eq(appointmentsTable.status, parsed.data.status));
  }

  const appointments = await db
    .select()
    .from(appointmentsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(appointmentsTable.scheduledDate), asc(appointmentsTable.startTime));

  res.json(ListAppointmentsResponse.parse(appointments.map(toApiAppointment)));
});

router.post("/appointments", async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const timeError = validateTimeRange(parsed.data.startTime, parsed.data.endTime);
  if (timeError) {
    res.status(400).json({ error: timeError });
    return;
  }

  const date = toDateString(parsed.data.date);
  if (await hasTimeConflict(date, parsed.data.startTime, parsed.data.endTime)) {
    res.status(400).json({
      error: "This time overlaps an existing appointment. Choose another slot.",
    });
    return;
  }

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({
      title: parsed.data.title.trim(),
      description: parsed.data.description,
      scheduledDate: date,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      status: "scheduled",
    })
    .returning();

  res.status(201).json(CreateAppointmentResponse.parse(toApiAppointment(appointment)));
});

router.get("/appointments/summary", async (_req, res): Promise<void> => {
  const appointments = await db
    .select({ status: appointmentsTable.status })
    .from(appointmentsTable);

  const summary = {
    total: appointments.length,
    scheduled: appointments.filter((item) => item.status === "scheduled").length,
    completed: appointments.filter((item) => item.status === "completed").length,
    cancelled: appointments.filter((item) => item.status === "cancelled").length,
  };

  res.json(GetAppointmentSummaryResponse.parse(summary));
});

router.patch("/appointments/:id", async (req, res): Promise<void> => {
  const params = UpdateAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const timeError = validateTimeRange(parsed.data.startTime, parsed.data.endTime);
  if (timeError) {
    res.status(400).json({ error: timeError });
    return;
  }

  const [existing] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, params.data.id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Appointment not found." });
    return;
  }

  const date = toDateString(parsed.data.date);
  if (
    existing.status !== "cancelled" &&
    (await hasTimeConflict(date, parsed.data.startTime, parsed.data.endTime, params.data.id))
  ) {
    res.status(400).json({
      error: "This time overlaps an existing appointment. Choose another slot.",
    });
    return;
  }

  const [appointment] = await db
    .update(appointmentsTable)
    .set({
      title: parsed.data.title.trim(),
      description: parsed.data.description,
      scheduledDate: date,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      updatedAt: new Date(),
    })
    .where(eq(appointmentsTable.id, params.data.id))
    .returning();

  res.json(UpdateAppointmentResponse.parse(toApiAppointment(appointment)));
});

router.post("/appointments/:id/complete", async (req, res): Promise<void> => {
  const params = CompleteAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [appointment] = await db
    .update(appointmentsTable)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(appointmentsTable.id, params.data.id))
    .returning();

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found." });
    return;
  }

  res.json(CompleteAppointmentResponse.parse(toApiAppointment(appointment)));
});

router.post("/appointments/:id/cancel", async (req, res): Promise<void> => {
  const params = CancelAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [appointment] = await db
    .update(appointmentsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(appointmentsTable.id, params.data.id))
    .returning();

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found." });
    return;
  }

  res.json(CancelAppointmentResponse.parse(toApiAppointment(appointment)));
});

export default router;