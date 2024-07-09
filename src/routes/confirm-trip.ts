import dayjs from "dayjs";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { getMailClient } from "../lib/mail";
import { prisma } from "../lib/prisma";

export async function confirmTrip(app:FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/trips/:tripId/confirm', 
    {
      schema: {
        params: z.object({
          tripId: z.string().uuid()
        })
      }
    }, 
    async (request, reply) => {
      const { tripId } = request.params

      const trip = await prisma.trip.findUnique({
        where: {
          id: tripId
        },
        include: {
          participants: {
            where: {
              is_owner: false
            }
          }
        }
      })

      if (!trip) {
        throw new Error('Trip not found.')
      }

      if (trip.is_confirmed) {
        return reply.redirect(`http://localhost:3000/trips/${tripId}`)
      }

      await prisma.trip.update({
        data: {
          is_confirmed: true
        },
        where: {
          id: tripId
        }
      })

      const formattedStartDate = dayjs(trip.starts_at).format('LL')
      const formattedEndDate = dayjs(trip.ends_at).format('LL')

      const mail = await getMailClient()

      await Promise.all(trip.participants.map(async (participant) => {
        const confirmationLink = `http://localhost:3333/trips/${trip.id}/${participant.id}`

        const message = await mail.sendMail({
          from: {
            name: 'Equipe Plann.er',
            address:'oi@plann.er',
          },
          to: participant.email,
          subject: `Confirme sua presença na viagem para ${trip.destination}`,
          html: `
            <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
              <p>Você foi convidado(a) para participar de uma viagem para <strong>${trip.destination}</strong> nas datas de <strong>${formattedStartDate}</strong> até <strong>${formattedEndDate}</strong>.</p>
              </br>
              <p>Para confirmar sua presença na viagem, clique no link abaixo:</p>
              </br>
              <p><a href="${confirmationLink}">Confirmar viagem</a></p>
              </br>
              <p>Caso você não saiba do que se trata esse e-mail, apenas ignore esse e-mail.</p>
            </div>
          `.trim()
        })
      }))
      
      return reply.redirect(`http://localhost:3000/trips/${tripId}`)
    }
  )
}