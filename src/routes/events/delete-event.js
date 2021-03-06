const aws = require('aws-sdk');
const { last } = require('lodash');
const moment = require('moment');

const { Event } = require('../../models/event');
const { Team } = require('../../models/team');
const { User } = require('../../models/user');

const s3 = new aws.S3();

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' });
  }

  const eventId = req.params.eventId;

  let event;
  try {
    event = await Event.findOne({ _id: eventId });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Event not found' });
    }
    console.log(`Event ${eventId} failed to be found at delete-event`);
    return next(err);
  }

  if (!event) {
    return res.status(404).json({ general: 'Event not found' });
  }

  if (
    !event.managers.find(m => m.toString() === req.user.id) &&
    !req.user.isAdmin
  ) {
    return res.status(403).json({ general: 'Forbidden action' });
  }

  const endDate = moment(event.endDate).utc();
  const today = moment.utc();

  if (endDate.isBefore(today) && event.reviews > 0) {
    return res.status(423).json({
      general:
        'It cannot be removed because it already ended and has one or more reviews'
    });
  }

  const participantsPromises = event.participants.map(p =>
    User.findOne({ _id: p.toString() })
  );

  let participants;
  try {
    participants = await Promise.all(participantsPromises);
  } catch (err) {
    console.log('A participant failed to be found at delete-event');
    return next(err);
  }

  for (const participant of participants) {
    participant.events = participant.events.filter(
      e => e.toString() !== event.id
    );
    participant.updatedAt = moment.utc().toDate();

    try {
      await participant.save();
    } catch (err) {
      console.log(
        `Participant ${participant.id} failed to be updated at delete-event`
      );
      return next(err);
    }
  }

  if (event.photos && event.photos.length > 0) {
    for (const photo of event.photos) {
      const photoParams = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: `events/photos/${last(photo.url.split('/'))}`
      };

      try {
        await s3.deleteObject(photoParams).promise();
      } catch (err) {
        console.log(
          `Photo ${photoParams.Key} failed to be deleted at delete-event`
        );
        return next(err);
      }
    }
  }

  if (event.teams && event.teams.length > 0) {
    const teamsPromises = event.teams.map(t =>
      Team.findOne({ _id: t.toString() })
    );

    let teams;
    try {
      teams = await Promise.all(teamsPromises);
    } catch (err) {
      console.log('A team failed to be found at delete-event');
      return next(err);
    }

    for (const team of teams) {
      team.events = team.events.filter(e => e.toString() !== event.id);
      team.updatedAt = moment.utc().toDate();

      try {
        await team.save();
      } catch (err) {
        console.log(`Team ${team.id} failed to be updated at delete-event`);
        return next(err);
      }
    }
  }

  try {
    await event.remove();
  } catch (err) {
    console.log(`Event ${event.id} failed to be removed at delete-event`);
    return next(err);
  }

  return res.status(204).json({ general: 'Success' });
};
