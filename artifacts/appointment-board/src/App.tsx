import { type FormEvent, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  Info,
  LayoutGrid,
  ListFilter,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  AppointmentStatus,
  getGetAppointmentSummaryQueryKey,
  getListAppointmentsQueryKey,
  useCancelAppointment,
  useCompleteAppointment,
  useCreateAppointment,
  useGetAppointmentSummary,
  useListAppointments,
  useUpdateAppointment,
  type Appointment,
  type AppointmentInput,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

type FilterStatus = 'all' | AppointmentStatus;
type Notice = { kind: 'success' | 'error'; text: string } | null;

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const prettyDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(
    new Date(`${value}T12:00:00`),
  );

const shortDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`));

const timeLabel = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute);
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
};

const statusLabel = (status: AppointmentStatus) => status.charAt(0).toUpperCase() + status.slice(1);

function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="app-noise min-h-[100dvh] bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] flex-col bg-sidebar px-5 py-6 text-sidebar-foreground lg:flex">
        <Link href="/" className="mb-12 flex items-center gap-3 no-underline" data-testid="link-brand">
          <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-accent text-accent-foreground">
            <CalendarDays size={19} strokeWidth={2.5} />
          </span>
          <span className="font-display text-[22px] tracking-[-0.03em]">Daymark</span>
        </Link>
        <div className="mb-3 px-3 font-mono-app text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/45">Workspace</div>
        <nav className="space-y-1">
          <Link href="/" data-testid="link-board" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${location === '/' ? 'bg-sidebar-foreground/10 text-sidebar-foreground' : 'text-sidebar-foreground/60 hover:bg-sidebar-foreground/7 hover:text-sidebar-foreground'}`}>
            <LayoutGrid size={17} /> Board
          </Link>
          <Link href="/about" data-testid="link-about" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${location === '/about' ? 'bg-sidebar-foreground/10 text-sidebar-foreground' : 'text-sidebar-foreground/60 hover:bg-sidebar-foreground/7 hover:text-sidebar-foreground'}`}>
            <Info size={17} /> How it works
          </Link>
        </nav>
        <div className="mt-auto rounded-2xl border border-sidebar-foreground/10 bg-sidebar-foreground/5 p-4">
          <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><Clock3 size={14} /></div>
          <p className="mb-1 text-sm font-semibold">Keep the day human.</p>
          <p className="text-xs leading-relaxed text-sidebar-foreground/55">A quiet place to see what needs your attention next.</p>
        </div>
      </aside>
      <div className="lg:pl-[238px]">{children}</div>
    </div>
  );
}

function MobileHeader() {
  return (
    <header className="flex items-center justify-between border-b border-border/70 bg-background/90 px-5 py-4 backdrop-blur lg:hidden">
      <Link href="/" className="flex items-center gap-2.5" data-testid="link-mobile-brand">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent text-accent-foreground"><CalendarDays size={17} /></span>
        <span className="font-display text-xl">Daymark</span>
      </Link>
      <Link href="/about" className="text-sm text-muted-foreground" data-testid="link-mobile-about">About</Link>
    </header>
  );
}

function SummaryStrip() {
  const summaryQuery = useGetAppointmentSummary({ query: { queryKey: getGetAppointmentSummaryQueryKey() } });
  const summary = summaryQuery.data;
  const items = [
    { label: 'Total', key: 'total', value: summary?.total, accent: 'bg-primary' },
    { label: 'Scheduled', key: 'scheduled', value: summary?.scheduled, accent: 'bg-accent' },
    { label: 'Completed', key: 'completed', value: summary?.completed, accent: 'bg-[#7d9b83]' },
    { label: 'Cancelled', key: 'cancelled', value: summary?.cancelled, accent: 'bg-[#b9a48e]' },
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.key} className="group rounded-2xl border border-card-border bg-card px-4 py-4 shadow-[var(--shadow-sm)] transition-transform duration-200 hover:-translate-y-0.5" data-testid={`summary-${item.key}`}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
            <span className={`h-2 w-2 rounded-full ${item.accent}`} />
          </div>
          {summaryQuery.isLoading ? <div className="skeleton h-8 w-12 rounded-md" /> : <div className="font-display text-[30px] leading-none">{item.value ?? '—'}</div>}
        </div>
      ))}
    </div>
  );
}

function AppointmentForm({ appointment, onClose, onSaved }: { appointment?: Appointment; onClose: () => void; onSaved: (text: string) => void }) {
  const isEditing = Boolean(appointment);
  const [form, setForm] = useState<AppointmentInput>({
    title: appointment?.title ?? '',
    description: appointment?.description ?? '',
    date: appointment?.date ?? today(),
    startTime: appointment?.startTime ?? '09:00',
    endTime: appointment?.endTime ?? '09:30',
  });
  const [formError, setFormError] = useState('');
  const create = useCreateAppointment();
  const update = useUpdateAppointment();
  const isPending = create.isPending || update.isPending;
  const setField = (key: keyof AppointmentInput, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return setFormError('Give this appointment a title.');
    if (form.endTime <= form.startTime) return setFormError('End time needs to be after start time.');
    setFormError('');
    if (isEditing && appointment) {
      update.mutate({ id: appointment.id, data: form }, {
        onSuccess: () => { onSaved('Appointment updated'); onClose(); },
        onError: () => setFormError('Could not update this appointment. Please try again.'),
      });
    } else {
      create.mutate({ data: form }, {
        onSuccess: () => { onSaved('Appointment added to the board'); onClose(); },
        onError: () => setFormError('Could not add this appointment. Please try again.'),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/25 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" role="dialog" aria-modal="true" data-testid="dialog-appointment">
      <div className="animate-rise-in w-full max-w-[520px] rounded-t-[26px] border border-card-border bg-card p-6 shadow-[0_24px_70px_rgba(45,50,58,.18)] sm:rounded-[26px] sm:p-8">
        <div className="mb-7 flex items-start justify-between">
          <div>
            <div className="mb-2 font-mono-app text-[10px] uppercase tracking-[0.18em] text-accent">{isEditing ? 'Edit appointment' : 'New appointment'}</div>
            <h2 className="font-display text-[30px] leading-none">{isEditing ? 'Tune the details' : 'Make room for it'}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Close appointment form" data-testid="button-close-form"><X size={19} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Title</span><input autoFocus value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="e.g. Client check-in" className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground/55 focus:ring-2 focus:ring-ring/25" data-testid="input-title" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">A little context <span className="font-normal opacity-60">(optional)</span></span><textarea value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="What would be useful to remember?" rows={2} maxLength={500} className="w-full resize-none rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground/55 focus:ring-2 focus:ring-ring/25" data-testid="input-description" /></label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block sm:col-span-1"><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Date</span><input type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/25" data-testid="input-date" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Starts</span><input type="time" value={form.startTime} onChange={(e) => setField('startTime', e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/25" data-testid="input-start-time" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Ends</span><input type="time" value={form.endTime} onChange={(e) => setField('endTime', e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/25" data-testid="input-end-time" /></label>
          </div>
          {formError && <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-xs text-destructive" data-testid="status-form-error"><CircleAlert size={15} /> {formError}</div>}
          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted" data-testid="button-cancel-form">Keep browsing</button>
            <button type="submit" disabled={isPending} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-save-appointment">{isPending && <LoaderCircle size={15} className="animate-spin" />}{isEditing ? 'Save changes' : 'Add appointment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AppointmentCard({ appointment, onEdit, onComplete, onCancel, busy }: { appointment: Appointment; onEdit: () => void; onComplete: () => void; onCancel: () => void; busy: boolean }) {
  const isCancelled = appointment.status === AppointmentStatus.cancelled;
  const isCompleted = appointment.status === AppointmentStatus.completed;
  return (
    <article className={`group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] ${isCancelled ? 'border-card-border opacity-70' : 'border-card-border'}`} data-testid={`card-appointment-${appointment.id}`}>
      <div className={`absolute inset-y-0 left-0 w-1 ${isCancelled ? 'bg-[#b9a48e]' : isCompleted ? 'bg-[#7d9b83]' : 'bg-accent'}`} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono-app text-xs text-primary">{timeLabel(appointment.startTime)} <span className="text-muted-foreground/65">— {timeLabel(appointment.endTime)}</span></span>
            <StatusBadge status={appointment.status} />
          </div>
          <h3 className={`text-[17px] font-semibold tracking-[-0.015em] ${isCancelled ? 'line-through decoration-muted-foreground/45' : ''}`} data-testid={`text-appointment-title-${appointment.id}`}>{appointment.title}</h3>
          {appointment.description && <p className="mt-1.5 max-w-[580px] text-sm leading-relaxed text-muted-foreground">{appointment.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
          {!isCompleted && !isCancelled && <button onClick={onComplete} disabled={busy} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-[#e4efe7] hover:text-[#52725b] disabled:opacity-50" aria-label="Mark appointment completed" data-testid={`button-complete-${appointment.id}`}><Check size={16} /></button>}
          {!isCancelled && <button onClick={onEdit} disabled={busy} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50" aria-label="Edit appointment" data-testid={`button-edit-${appointment.id}`}><Pencil size={16} /></button>}
          {!isCompleted && !isCancelled && <button onClick={onCancel} disabled={busy} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50" aria-label="Cancel appointment" data-testid={`button-cancel-${appointment.id}`}><Trash2 size={16} /></button>}
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const styles = { scheduled: 'bg-accent/12 text-[#a54e42]', completed: 'bg-[#e4efe7] text-[#52725b]', cancelled: 'bg-muted text-muted-foreground' };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${styles[status]}`} data-testid={`status-appointment-${status}`}>{statusLabel(status)}</span>;
}

function Board() {
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<FilterStatus>('all');
  const [modal, setModal] = useState<Appointment | 'new' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const queryClientInstance = useQueryClient();
  const params = useMemo(() => ({ date, ...(status === 'all' ? {} : { status }) }), [date, status]);
  const appointmentsQuery = useListAppointments(params);
  const complete = useCompleteAppointment();
  const cancel = useCancelAppointment();
  const appointments = useMemo(() => [...(appointmentsQuery.data ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime)), [appointmentsQuery.data]);
  const busy = complete.isPending || cancel.isPending;

  const invalidate = () => {
    queryClientInstance.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
    queryClientInstance.invalidateQueries({ queryKey: getGetAppointmentSummaryQueryKey() });
  };
  const flash = (kind: 'success' | 'error', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 3600);
  };
  const markComplete = (id: number) => complete.mutate({ id }, { onSuccess: () => { invalidate(); flash('success', 'Marked complete'); }, onError: () => flash('error', 'Could not mark that appointment complete') });
  const cancelAppointment = (id: number) => cancel.mutate({ id }, { onSuccess: () => { invalidate(); setConfirmId(null); flash('success', 'Appointment cancelled and kept on the board'); }, onError: () => flash('error', 'Could not cancel that appointment') });
  const shiftDate = (amount: number) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + amount);
    setDate(next.toISOString().slice(0, 10));
  };

  return (
    <main className="min-h-[100dvh]">
      <MobileHeader />
      <div className="mx-auto max-w-[1240px] px-5 pb-16 pt-8 sm:px-8 lg:px-12 lg:pt-12">
        <header className="mb-9 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="animate-rise-in">
            <div className="mb-3 flex items-center gap-2 font-mono-app text-[10px] uppercase tracking-[0.2em] text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Appointment board</div>
            <h1 className="font-display text-[clamp(38px,5vw,60px)] leading-[.95] tracking-[-0.04em]">Make the day<br /><span className="text-primary">legible.</span></h1>
            <p className="mt-4 max-w-[430px] text-[15px] leading-relaxed text-muted-foreground">A focused view of the commitments that matter, with just enough room for the human details.</p>
          </div>
          <button onClick={() => setModal('new')} className="flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_5px_0_hsl(196_54%_25%)] transition-all hover:-translate-y-0.5 hover:shadow-[0_7px_0_hsl(196_54%_25%)] active:translate-y-0 active:shadow-[0_2px_0_hsl(196_54%_25%)]" data-testid="button-add-appointment"><Plus size={17} /> Add appointment</button>
        </header>

        <SummaryStrip />

        <section className="mt-10">
          <div className="mb-5 flex flex-col gap-4 border-b border-border/80 pb-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => shiftDate(-1)} className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Previous day" data-testid="button-previous-day"><ChevronLeft size={16} /></button>
              <button onClick={() => setDate(today())} className="min-w-[175px] rounded-lg border border-border bg-card px-3 py-2 text-center text-sm font-semibold transition-colors hover:bg-muted" data-testid="button-today">{date === today() ? 'Today' : prettyDate(date)}</button>
              <button onClick={() => shiftDate(1)} className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Next day" data-testid="button-next-day"><ChevronRight size={16} /></button>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-muted-foreground" />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-xs text-muted-foreground outline-none focus:ring-2 focus:ring-ring/20" aria-label="Filter by date" data-testid="input-filter-date" />
            </div>
          </div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><ListFilter size={16} className="text-accent" /> {prettyDate(date)}</div>
            <div className="flex rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Filter by status">
              {(['all', 'scheduled', 'completed', 'cancelled'] as FilterStatus[]).map((item) => <button key={item} onClick={() => setStatus(item)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${status === item ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'}`} data-testid={`filter-status-${item}`}>{item === 'all' ? 'All' : statusLabel(item)}</button>)}
            </div>
          </div>

          {notice && <div className={`mb-5 flex items-center gap-2 rounded-xl border px-3.5 py-3 text-sm ${notice.kind === 'success' ? 'border-[#bed5c4] bg-[#eaf3ec] text-[#52725b]' : 'border-destructive/20 bg-destructive/10 text-destructive'}`} role="status" data-testid="status-notice">{notice.kind === 'success' ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}{notice.text}</div>}
          {appointmentsQuery.isLoading && <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="skeleton h-[120px] rounded-2xl" data-testid={`skeleton-appointment-${item}`} />)}</div>}
          {appointmentsQuery.isError && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-10 text-center" data-testid="state-appointments-error"><CircleAlert className="mx-auto mb-3 text-destructive" size={25} /><h2 className="font-display text-2xl">The board is taking a breather.</h2><p className="mt-2 text-sm text-muted-foreground">We couldn't load these appointments just now.</p><button onClick={() => appointmentsQuery.refetch()} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted" data-testid="button-retry-appointments"><RotateCcw size={14} /> Try again</button></div>}
          {!appointmentsQuery.isLoading && !appointmentsQuery.isError && appointments.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card/55 px-6 py-14 text-center" data-testid="state-appointments-empty"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground"><CalendarDays size={22} /></div><h2 className="font-display text-2xl">{status === 'all' ? 'A little breathing room.' : `No ${statusLabel(status).toLowerCase()} appointments here.`}</h2><p className="mx-auto mt-2 max-w-[330px] text-sm leading-relaxed text-muted-foreground">{status === 'all' ? 'Nothing is booked for this day yet. Add the first commitment when you are ready.' : 'Try another status or choose a different day.'}</p>{status === 'all' && <button onClick={() => setModal('new')} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground" data-testid="button-empty-add"><Plus size={15} /> Add appointment</button>}</div>}
          {!appointmentsQuery.isLoading && !appointmentsQuery.isError && appointments.length > 0 && <div className="space-y-3">{appointments.map((appointment, index) => <div key={appointment.id} className="animate-rise-in" style={{ animationDelay: `${index * 60}ms` }}><AppointmentCard appointment={appointment} onEdit={() => setModal(appointment)} onComplete={() => markComplete(appointment.id)} onCancel={() => setConfirmId(appointment.id)} busy={busy} /></div>)}</div>}
        </section>
      </div>
      {modal && <AppointmentForm appointment={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} onSaved={(text) => { invalidate(); flash('success', text); }} />}
      {confirmId !== null && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-5 backdrop-blur-[2px]" role="dialog" aria-modal="true" data-testid="dialog-confirm-cancel"><div className="animate-rise-in w-full max-w-[390px] rounded-2xl border border-card-border bg-card p-6 shadow-[0_24px_70px_rgba(45,50,58,.18)]"><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><XCircle size={20} /></div><h2 className="font-display text-2xl">Cancel this appointment?</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">It will stay visible on the board as cancelled, so the day's story remains intact.</p><div className="mt-6 flex gap-3"><button onClick={() => setConfirmId(null)} className="flex-1 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold hover:bg-muted" data-testid="button-dismiss-cancel">Keep it</button><button onClick={() => cancelAppointment(confirmId)} disabled={cancel.isPending} className="flex-1 rounded-xl bg-destructive px-3 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-60" data-testid="button-confirm-cancel">{cancel.isPending ? 'Cancelling…' : 'Cancel appointment'}</button></div></div></div>}
    </main>
  );
}

function About() {
  return (
    <main className="min-h-[100dvh]">
      <MobileHeader />
      <div className="mx-auto max-w-[900px] px-5 pb-20 pt-12 sm:px-8 lg:px-12 lg:pt-20">
        <div className="mb-12 max-w-[650px] animate-rise-in"><div className="mb-4 font-mono-app text-[10px] uppercase tracking-[0.2em] text-accent">A small guide to Daymark</div><h1 className="font-display text-[clamp(42px,6vw,72px)] leading-[.94] tracking-[-0.04em]">The day, without<br /><span className="text-primary">the noise.</span></h1><p className="mt-6 text-lg leading-relaxed text-muted-foreground">Daymark is a focused appointment workspace for small teams. It keeps commitments visible, editable, and human without asking you to manage a whole system.</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-card-border bg-card p-6 shadow-[var(--shadow-sm)]"><div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><LayoutGrid size={19} /></div><h2 className="font-display text-2xl">One board, one date</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">The board opens to today and sorts appointments by start time. Use the date controls to look backward or forward without losing your place.</p></div>
          <div className="rounded-2xl border border-card-border bg-card p-6 shadow-[var(--shadow-sm)]"><div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4efe7] text-[#52725b]"><CheckCircle2 size={19} /></div><h2 className="font-display text-2xl">Status with memory</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Complete or cancel from the card. Cancelled appointments remain visible, making it easier to understand what happened to a day.</p></div>
        </div>
        <div className="my-10 border-l-2 border-accent/50 pl-5"><p className="font-display text-[25px] leading-snug">“Clarity is not more information. It is knowing what deserves your attention now.”</p></div>
        <div className="rounded-2xl bg-sidebar p-6 text-sidebar-foreground sm:p-8"><div className="mb-3 flex items-center gap-2 font-mono-app text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/55"><FileText size={13} /> The assumptions</div><ul className="space-y-3 text-sm leading-relaxed text-sidebar-foreground/75"><li>• Appointments belong to one calendar date and have a start and end time.</li><li>• A completed or cancelled appointment is kept as part of the day's record.</li><li>• This workspace is intentionally small: there are no projects, contacts, or extra layers to maintain.</li></ul></div>
        <Link href="/" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" data-testid="link-back-board"><ChevronLeft size={16} /> Back to the board</Link>
      </div>
    </main>
  );
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={() => <AppShell><Board /></AppShell>} /><Route path="/about" component={() => <AppShell><About /></AppShell>} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><Router /></QueryClientProvider>;
}

export default App;