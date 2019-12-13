import User from '../models/User';
import File from '../models/File';
import Appointment from '../models/Appointment';

import CreateAppointmentService from '../services/CreateAppointmentService';
import CancelApointmentService from '../services/CancelAppointmentService';

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

        const appointment = await CreateAppointmentService.run({
            provider_id,
            user_id: req.userId,
            date,
        });

        return res.json(appointment);
    }

    async delete(req, res) {
        const appointment = await CancelApointmentService.run({
            provider_id: req.params.id,
            user_id: req.userId,
        });

        return res.json(appointment);
    }
}

export default new AppointmentController();
