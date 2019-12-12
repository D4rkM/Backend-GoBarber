import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';
import User from '../models/User';
import File from '../models/File';
import Appointment from '../models/Appointment';
import Notification from '../schemas/Notification';

import CancellationMail from '../jobs/CancellationMail';
import Queue from '../../lib/Queue';

class AppointmentController {
    async index(req, res) {
        const { page = 1 } = req.query;

        const appointments = await Appointment.findAll({
            where: { user_id: req.userId, canceled_at: null },
            limit: 20,
            offset: (page - 1) * 20,
            order: ['date'],
            attributes: ['id', 'date', 'past', 'cancelable'],
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: ['id', 'name'],
                    include: [
                        {
                            model: File,
                            as: 'avatar',
                            attributes: ['id', 'path', 'url'],
                        },
                    ],
                },
            ],
        });

        res.json(appointments);
    }

    async store(req, res) {
        const { provider_id, date } = req.body;

        /**
         * Check if user and provider are not the same
         */

        if (req.userId === provider_id) {
            return res.status(401).json({
                message: "You can't create an appointment with yourself",
            });
        }
        /**
         * Check if provider_id is a provider
         */

        const isProvider = await User.findOne({
            where: { id: provider_id, provider: true },
        });

        if (!isProvider) {
            return res.status(401).json({
                message: 'You can only create appointments with providers',
            });
        }

        const hourStart = startOfHour(parseISO(date));

        /**
         * Check for past dates
         */

        if (isBefore(hourStart, new Date())) {
            return res
                .status(400)
                .json({ error: 'Past dates are not permited' });
        }

        /**
         * Check date availability
         */

        const checkAvailability = await Appointment.findOne({
            where: {
                provider_id,
                canceled_at: null,
                date: hourStart,
            },
        });

        if (checkAvailability) {
            return res
                .status(400)
                .json({ error: 'Appointment date is not available' });
        }

        const appointment = await Appointment.create({
            user_id: req.userId,
            provider_id,
            date,
        });

        const user = await User.findByPk(req.userId);
        const formatedDate = format(
            hourStart,
            "'dia' dd 'de' MMMM', às' H:mm'h'",
            { locale: pt }
        );
        /**
         * Notify appointment provider
         */

        await Notification.create({
            content: `Novo agendamento de ${user.name} para ${formatedDate}`,
            user: provider_id,
        });

        return res.json(appointment);
    }

    async delete(req, res) {
        const appointment = await Appointment.findByPk(req.params.id, {
            include: [
                { model: User, as: 'provider', attributes: ['name', 'email'] },
                {
                    model: User,
                    as: 'user',
                    attributes: ['name'],
                },
            ],
        });

        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        if (appointment.user_id !== req.userId) {
            return res.status(401).json({
                error: "You don't have permission to cancel this appointment.",
            });
        }

        const dateWithSub = subHours(appointment.date, 2);

        if (isBefore(dateWithSub, new Date())) {
            return res.status(401).json({
                error: 'You can only cancel appointments 2 hours in advance.',
            });
        }

        appointment.canceled_at = new Date();

        await appointment.save();

        await Queue.add(CancellationMail.key, {
            appointment,
        });

        return res.json(appointment);
    }
}

export default new AppointmentController();
