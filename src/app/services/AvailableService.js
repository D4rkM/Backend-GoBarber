import {
    startOfDay,
    endOfDay,
    isAfter,
    setHours,
    setMinutes,
    setSeconds,
    format,
} from 'date-fns';
import { Op } from 'sequelize';

import Appointment from '../models/Appointment';
import Schedule from '../schemas/Schedule';

class AvailableService {
    async run({ provider_id, date }) {
        const appointments = await Appointment.findAll({
            where: {
                provider_id,
                canceled_at: null,
                date: {
                    [Op.between]: [startOfDay(date), endOfDay(date)],
                },
            },
        });

        const { hours } = await Schedule.findOne({});

        const available = hours.map(time => {
            const [hour, minute] = time.split(':');
            const value = setSeconds(
                setMinutes(setHours(date, hour), minute),
                0
            );

            return {
                time,
                value: format(value, "yyyy-MM-dd'T'HH:mm:ssxxx"),
                available:
                    isAfter(value, new Date()) &&
                    !appointments.find(a => format(a.date, 'HH:mm') === time),
            };
        });

        return available;
    }
}

export default new AvailableService();
