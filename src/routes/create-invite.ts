import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import nodemailer from "nodemailer";
import z from "zod";
import { env } from "../env";
import { ClientError } from "../errors/client-error";
import { dayjs } from "../lib/dayjs";
import { getMailClient } from "../lib/mail";
import { prisma } from "../lib/prisma";

export async function createInvite(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/trips/:tripId/invites',
    {
      schema: {
        body: z.object({
          email: z.string().email()
        }),
        params: z.object({
          tripId: z.string().uuid()
        })
      }
    },
    async (request, reply) => {
      const { tripId } = request.params

      const { email } = request.body

      const trip = await prisma.trip.findUnique({
        where: {
          id: tripId
        }
      })

      if (!trip) {
        throw new ClientError('Trip not found.')
      }

      const participant = await prisma.participant.create({
        data: {
          email,
          trip_id: tripId
        }
      })

      const formattedStartDate = dayjs(trip.starts_at).format('LL')
      const formattedEndDate = dayjs(trip.ends_at).format('LL')

      const mail = await getMailClient()

      const confirmationLink = `${env.API_BASE_URL}/participants/${participant.id}/confirm`

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

      console.log(nodemailer.getTestMessageUrl(message))

      return { participantId: participant.id }
    }
  )
}