
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import nodemailer from "nodemailer";
import z from "zod";
import { env } from "../env";
import { ClientError } from "../errors/client-error";
import { dayjs } from "../lib/dayjs";
import { getMailClient } from "../lib/mail";
import { prisma } from "../lib/prisma";

export async function createTrip(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/trips', {
    schema: {
      body: z.object({
        destination: z.string().min(4),
        starts_at: z.coerce.date(),
        ends_at: z.coerce.date(),
        owner_name: z.string(),
        owner_email: z.string().email(),
        emails_to_invite: z.array(z.string().email())
      })
    }
  }, 
  async (request, reply) => {
    const { destination, ends_at, starts_at, owner_email, owner_name, emails_to_invite } = request.body

    if (dayjs(starts_at).isBefore(new Date())) {
        throw new ClientError('Invalid trip start date.')
    }

    if (dayjs(ends_at).isBefore(starts_at)) {
        throw new ClientError('Invalid trip end date')
    }

    const trip = await prisma.trip.create({
      data: {
        destination,
        ends_at,
        starts_at,
        participants: {
          createMany: {
            data: [
              {
                email: owner_email,
                name: owner_name,
                is_owner: true,
                is_confirmed: true
              },
                ...emails_to_invite.map((email) => {
                return { email }
              })
            ]
          }
        }
      }
    })

    const confirmationLink = `${env.API_BASE_URL}/trips/:tripId/confirm`

    const formattedStartDate = dayjs(starts_at).format('LL')
    const formattedEndDate = dayjs(ends_at).format('LL')

    const mail = await getMailClient()

    const message = await mail.sendMail({
      from: {
        name: 'Equipe Plann.er',
        address:'oi@plann.er',
      },
      to: {
        name: owner_name,
        address: owner_email,
      },
      subject: `Confirme sua viagem para ${destination}`,
      html: `
        <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
          <p>Você solicitou a criação de uma viagem para <strong>${destination}</strong> nas datas de <strong>${formattedStartDate}</strong> até <strong>${formattedEndDate}</strong>.</p>
          </br>
          <p>Para confirmar sua viagem, clique no link abaixo:</p>
          </br>
          <p><a href="${confirmationLink}">Confirmar viagem</a></p>
          </br>
          <p>Caso você não saiba do que se trata esse e-mail, apenas ignore esse e-mail.</p>
        </div>
      `.trim()
    })

    nodemailer.getTestMessageUrl(message)

    return { tripId: trip.id }
  })
}