# Appointment Board

A full-stack appointment scheduling board built for the Appening Infotech interview task.

## Features

- View appointments in a responsive board
- Add, edit, complete, and cancel appointments
- Filter by date and status
- Prevent overlapping time slots for active appointments
- Keep cancelled appointments visible while allowing their time slots to be reused
- Success and error feedback for user actions
- About page documenting assumptions and implementation notes

## Tech stack

- React + Vite + TypeScript
- Express API server
- PostgreSQL with Drizzle ORM
- OpenAPI-generated React Query and Zod clients
- pnpm workspace monorepo

## Local development

1. Install dependencies with pnpm install.
2. Configure the database connection and session secret in your environment.
3. Start the API and web workflows using the project commands.

The app uses the shared API server and PostgreSQL schema included in this repository.
