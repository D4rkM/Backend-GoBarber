import mongoose from 'mongoose';

const ScheduleSchema = new mongoose.Schema({
    hours: Array,
});

export default mongoose.model('Schedule', ScheduleSchema);
