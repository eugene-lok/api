const moment = require('moment')

const Event = require('../../models/event')
const logger = require('../../helpers/logger')
const Petition = require('../../models/petition')
const Team = require('../../models/team')
const User = require('../../models/user')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' })
  }

  const petitionId = req.params.petitionId

  let petition
  try {
    petition = await Petition.findOne({ _id: petitionId })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Petition not found' })
    }

    logger.error(`Petition ${petitionId} failed to be found at edit-petition`)
    return next(err)
  }

  if (!petition) {
    return res.status(404).json({ general: 'Petition not found' })
  }

  if (petition.state !== 'pending') {
    return res.status(423).json({ general: `Is already ${petition.state}` })
  }

  if (petition.type.endsWith('event')) {
    let eventEntity
    try {
      eventEntity = await Event.findOne({ _id: petition.entityId })
    } catch (err) {
      logger.error(
        `Event ${petition.entityId} failed to be found at edit-petition`
      )
      return next(err)
    }

    if (!eventEntity) {
      try {
        await petition.remove()
      } catch (err) {
        logger.error(
          `Petition ${petition.id} failed to be removed at edit-petition`
        )
        return next(err)
      }

      return res.status(400).json({
        general: 'Event is already removed. This petition is being removed'
      })
    }

    if (petition.type === 'invite-team-event') {
      let teamReceiver
      try {
        teamReceiver = await Team.findOne({ _id: petition.receiverId })
      } catch (err) {
        logger.error(
          `Team ${petition.receiverId} failed to be found at edit-petition`
        )
        return next(err)
      }

      if (!teamReceiver) {
        try {
          await petition.remove()
        } catch (err) {
          logger.error(
            `Petition ${petition.id} failed to be removed at edit-petition`
          )
          return next(err)
        }

        return res.status(400).json({
          general: 'Team is already removed. This petition is being removed'
        })
      }

      if (!teamReceiver.managers.find(m => m.toString() === req.user.id)) {
        return res.status(403).json({ general: 'Forbidden action' })
      }

      if (eventEntity.teams.find(t => t.toString() === teamReceiver.id)) {
        try {
          await petition.remove()
        } catch (err) {
          logger.error(
            `Petition ${petition.id} failed to be removed at edit-petition`
          )
          return next(err)
        }

        return res.status(400).json({
          general: `Team ${teamReceiver.id} is already a participant of the event. This petition is being removed`
        })
      }

      if (req.body.state === 'accepted') {
        eventEntity.teams = [...eventEntity.teams, teamReceiver.id]
        eventEntity.updatedAt = moment.utc().toDate()

        try {
          await eventEntity.save()
        } catch (err) {
          logger.error(
            `Event ${eventEntity.id} failed to be updated at edit-petition`
          )
          return next(err)
        }

        teamReceiver.events = [...teamReceiver.events, eventEntity.id]
        teamReceiver.updatedAt = moment.utc().toDate()

        try {
          await teamReceiver.save()
        } catch (err) {
          logger.error(
            `Team ${teamReceiver.id} failed to be updated at edit-petition`
          )
          return next(err)
        }

        petition.state = 'accepted'
      } else if (req.body.state === 'rejected') {
        petition.state = 'rejected'
      } else {
        return res.status(400).json({ state: 'Invalid type of state' })
      }

      petition.updatedAt = moment.utc().toDate()

      try {
        await petition.save()
      } catch (err) {
        logger.error(
          `Petition ${petition.id} failed to be updated at edit-petition`
        )
        return next(err)
      }

      return res.status(200).json({ general: 'Success' })
    } else if (petition.type === 'invite-user-event') {
      if (petition.receiverId !== req.user.id) {
        return res.status(403).json({ general: 'Forbidden action' })
      }

      if (eventEntity.participants.find(p => p.toString() === req.user.id)) {
        try {
          await petition.remove()
        } catch (err) {
          logger.error(
            `Petition ${petition.id} failed to be removed at edit-petition`
          )
          return next(err)
        }

        return res.status(400).json({
          general:
            'You already are a participant of the event. This petition is being removed'
        })
      }

      if (req.body.state === 'accepted') {
        eventEntity.participants = [...eventEntity.participants, req.user.id]
        eventEntity.updatedAt = moment.utc().toDate()

        try {
          await eventEntity.save()
        } catch (err) {
          logger.error(
            `Event ${eventEntity.id} failed to be updated at edit-petition`
          )
          return next(err)
        }

        req.user.events = [...req.user.events, eventEntity.id]
        req.user.updatedAt = moment.utc().toDate()

        try {
          await req.user.save()
        } catch (err) {
          logger.error(
            `User ${req.user.id} failed to be updated at edit-petition`
          )
          return next(err)
        }

        petition.state = 'accepted'
      } else if (req.body.state === 'rejected') {
        petition.state = 'rejected'
      } else {
        return res.status(400).json({ state: 'Invalid type of state' })
      }

      petition.updatedAt = moment.utc().toDate()

      try {
        await petition.save()
      } catch (err) {
        logger.error(
          `Petition ${petition.id} failed to be updated at edit-petition`
        )
        return next(err)
      }

      return res.status(200).json({ general: 'Success' })
    } else if (petition.type === 'request-team-event') {
      if (!eventEntity.managers.find(m => m.toString() === req.user.id)) {
        return res.status(403).json({ general: 'Forbidden action' })
      }

      let teamSender
      try {
        teamSender = await Team.findOne({ _id: petition.senderId })
      } catch (err) {
        logger.error(
          `Team ${petition.senderId} failed to be found at edit-petition`
        )
        return next(err)
      }

      if (!teamSender) {
        try {
          await petition.remove()
        } catch (err) {
          logger.error(
            `Petition ${petition.id} failed to be removed at edit-petition`
          )
          return next(err)
        }

        return res.status(400).json({
          general: `Team ${teamSender.id} is already removed. This petition is being removed`
        })
      }

      if (eventEntity.teams.find(t => t.toString() === teamSender.id)) {
        try {
          await petition.remove()
        } catch (err) {
          logger.error(
            `Petition ${petition.id} failed to be removed at edit-petition`
          )
          return next(err)
        }

        return res.status(400).json({
          general: `Team ${teamSender.id} is already a participant of the event. This petition is being removed`
        })
      }

      if (req.body.state === 'accepted') {
        eventEntity.teams = [...eventEntity.teams, teamSender.id]
        eventEntity.updatedAt = moment.utc().toDate()

        try {
          await eventEntity.save()
        } catch (err) {
          logger.error(
            `Event ${eventEntity.id} failed to be updated at edit-petition`
          )
          return next(err)
        }

        teamSender.events = [...teamSender.events, eventEntity.id]
        teamSender.updatedAt = moment.utc().toDate()

        try {
          await teamSender.save()
        } catch (err) {
          logger.error(
            `Team ${teamSender.id} failed to be updated at edit-petition`
          )
          return next(err)
        }

        petition.state = 'accepted'
      } else if (req.body.state === 'rejected') {
        petition.state = 'rejected'
      } else {
        return res.status(400).json({ state: 'Invalid type of state' })
      }

      petition.updatedAt = moment.utc().toDate()

      try {
        await petition.save()
      } catch (err) {
        logger.error(
          `Petition ${petition.id} failed to be updated at edit-petition`
        )
        return next(err)
      }

      return res.status(200).json({ general: 'Success' })
    }
    // petition.type === 'request-user-event'

    if (!eventEntity.managers.find(m => m.toString() === req.user.id)) {
      return res.status(403).json({ general: 'Forbidden action' })
    }

    let userSender
    try {
      userSender = await User.findOne({ _id: petition.senderId })
    } catch (err) {
      logger.error(
        `User ${petition.senderId} failed to be found at edit-petition`
      )
      return next(err)
    }

    if (!userSender) {
      try {
        await petition.remove()
      } catch (err) {
        logger.error(
          `Petition ${petition.id} failed to be removed at edit-petition`
        )
        return next(err)
      }

      return res.status(400).json({
        general: `User ${petition.senderId} is already removed. This petition is being removed`
      })
    }

    if (eventEntity.participants.find(p => p.toString() === userSender.id)) {
      try {
        await petition.remove()
      } catch (err) {
        logger.error(
          `Petition ${petition.id} failed to be removed at edit-petition`
        )
        return next(err)
      }

      return res.status(400).json({
        general: `User ${userSender.id} is already a participant of the event. This petition is being removed`
      })
    }

    if (req.body.state === 'accepted') {
      eventEntity.participants = [...eventEntity.participants, userSender.id]
      eventEntity.updatedAt = moment.utc().toDate()

      try {
        await eventEntity.save()
      } catch (err) {
        logger.error(
          `Event ${eventEntity.id} failed to be updated at edit-petition`
        )
        return next(err)
      }

      userSender.events = [...userSender.events, eventEntity.id]
      userSender.updatedAt = moment.utc().toDate()

      try {
        await userSender.save()
      } catch (err) {
        logger.error(
          `User ${userSender.id} failed to be updated at edit-petition`
        )
        return next(err)
      }

      petition.state = 'accepted'
    } else if (req.body.state === 'rejected') {
      petition.state = 'rejected'
    } else {
      return res.status(400).json({ state: 'Invalid type of state' })
    }

    petition.updatedAt = moment.utc().toDate()

    try {
      await petition.save()
    } catch (err) {
      logger.error(
        `Petition ${petition.id} failed to be updated at edit-petition`
      )
      return next(err)
    }

    return res.status(200).json({ general: 'Success' })
  }
  // petition.type.endsWith('team')

  let teamEntity
  try {
    teamEntity = await Team.findOne({ _id: petition.entityId })
  } catch (err) {
    logger.error(
      `Team ${petition.entityId} failed to be found at edit-petition`
    )
    return next(err)
  }

  if (!teamEntity) {
    try {
      await petition.remove()
    } catch (err) {
      logger.error(
        `Petition ${petition.id} failed to be removed at edit-petition`
      )
      return next(err)
    }

    return res.status(400).json({
      general: 'Team is already removed. This petition is being removed'
    })
  }

  if (petition.type === 'invite-user-team') {
    if (petition.receiverId !== req.user.id) {
      return res.status(403).json({ general: 'Forbidden action' })
    }

    if (teamEntity.members.find(m => m.toString() === petition.receiverId)) {
      try {
        await petition.remove()
      } catch (err) {
        logger.error(
          `Petition ${petition.id} failed to be removed at edit-petition`
        )
        return next(err)
      }

      return res.status(400).json({
        general:
          'You already are a member of the team. This petition is being removed'
      })
    }

    if (req.body.state === 'accepted') {
      teamEntity.members = [...teamEntity.members, req.user.id]
      teamEntity.updatedAt = moment.utc().toDate()

      try {
        await teamEntity.save()
      } catch (err) {
        logger.error(
          `Team ${teamEntity.id} failed to be updated at edit-petition`
        )
        return next(err)
      }

      req.user.teams = [...req.user.teams, teamEntity.id]
      req.user.updatedAt = moment.utc().toDate()

      try {
        await req.user.save()
      } catch (err) {
        logger.error(
          `User ${req.user.id} failed to be updated at edit-petition`
        )
        return next(err)
      }

      petition.state = 'accepted'
    } else if (req.body.state === 'rejected') {
      petition.state = 'rejected'
    } else {
      return res.status(400).json({ state: 'Invalid type of state' })
    }

    petition.updatedAt = moment.utc().toDate()

    try {
      await petition.save()
    } catch (err) {
      logger.error(
        `Petition ${petition.id} failed to be updated at edit-petition`
      )
      return next(err)
    }

    return res.status(200).json({ general: 'Success' })
  }
  // petition.type === 'request-user-team'

  if (!teamEntity.managers.find(m => m.toString() === req.user.id)) {
    return res.status(403).json({ general: 'Forbidden action' })
  }

  let userSender
  try {
    userSender = await User.findOne({ _id: petition.senderId })
  } catch (err) {
    logger.error(
      `User ${petition.senderId} failed to be found at edit-petition`
    )
    return next(err)
  }

  if (!userSender) {
    try {
      await petition.remove()
    } catch (err) {
      logger.error(
        `Petition ${petition.id} failed to be removed at edit-petition`
      )
      return next(err)
    }

    return res.status(400).json({
      general: `User ${petition.senderId} is already removed. This petition is being removed`
    })
  }

  if (teamEntity.members.find(m => m.toString() === userSender.id)) {
    try {
      await petition.remove()
    } catch (err) {
      logger.error(
        `Petition ${petition.id} failed to be removed at edit-petition`
      )
      return next(err)
    }

    return res.status(400).json({
      general: `User ${userSender.id} is already a member of the team. This petition is being removed`
    })
  }

  if (req.body.state === 'accepted') {
    teamEntity.members = [...teamEntity.members, userSender.id]
    teamEntity.updatedAt = moment.utc().toDate()

    try {
      await teamEntity.save()
    } catch (err) {
      logger.error(
        `Team ${teamEntity.id} failed to be updated at edit-petition`
      )
      return next(err)
    }

    userSender.teams = [...userSender.teams, teamEntity.id]
    userSender.updatedAt = moment.utc().toDate()

    try {
      await userSender.save()
    } catch (err) {
      logger.error(
        `User ${userSender.id} failed to be updated at edit-petition`
      )
      return next(err)
    }

    petition.state = 'accepted'
  } else if (req.body.state === 'rejected') {
    petition.state = 'rejected'
  } else {
    return res.status(400).json({ state: 'Invalid type of state' })
  }

  petition.updatedAt = moment.utc().toDate()

  try {
    await petition.save()
  } catch (err) {
    logger.error(
      `Petition ${petition.id} failed to be updated at edit-petition`
    )
    return next(err)
  }

  return res.status(200).json({ general: 'Success' })
}
