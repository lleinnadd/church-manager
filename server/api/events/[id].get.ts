export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Event id is required' });
  }

  const series = await prisma.eventSeries.findUnique({
    where: { id },
    include: {
      daySchedules: { orderBy: { date: 'asc' } },
      congregation: { select: { id: true, name: true, type: true } },
      department: { select: { id: true, name: true } },
    },
  });

  if (!series) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' });
  }

  return series;
});
