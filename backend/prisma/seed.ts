import { PrismaClient, ChannelType, PartyMemberRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SquadLink database...');

  const passwordHash = await bcrypt.hash('squadlink123', 12);

  const roshan = await prisma.user.upsert({
    where: { email: 'roshan@aligncraft.dev' },
    update: {},
    create: {
      email: 'roshan@aligncraft.dev',
      handle: 'roshanv',
      displayName: 'Roshan Verk',
      passwordHash,
      emailVerifiedAt: new Date(),
      status: 'ONLINE',
      statusText: 'Grinding ranked',
      currentGame: 'Valorant',
      bio: 'Full-stack dev by day, IGL by night.',
      level: 47,
      preferences: { create: {} },
    },
  });

  const ava = await prisma.user.upsert({
    where: { email: 'ava@example.com' },
    update: {},
    create: {
      email: 'ava@example.com',
      handle: 'avachen',
      displayName: 'Ava Chen',
      passwordHash,
      emailVerifiedAt: new Date(),
      status: 'ONLINE',
      currentGame: 'Valorant',
      level: 32,
      preferences: { create: {} },
    },
  });

  const kofi = await prisma.user.upsert({
    where: { email: 'kofi@example.com' },
    update: {},
    create: {
      email: 'kofi@example.com',
      handle: 'kofim',
      displayName: 'Kofi Mensah',
      passwordHash,
      emailVerifiedAt: new Date(),
      status: 'IN_GAME',
      currentGame: 'Apex Legends',
      level: 58,
      preferences: { create: {} },
    },
  });

  // Friendship: Roshan <-> Ava
  await prisma.friendship.upsert({
    where: { userAId_userBId: { userAId: roshan.id, userBId: ava.id } },
    update: {},
    create: { userAId: roshan.id, userBId: ava.id },
  });

  // Pending request: Kofi -> Roshan
  const existingRequest = await prisma.friendRequest.findFirst({
    where: { senderId: kofi.id, receiverId: roshan.id },
  });
  if (!existingRequest) {
    await prisma.friendRequest.create({
      data: { senderId: kofi.id, receiverId: roshan.id },
    });
  }

  // DM conversation with a couple of messages
  let dm = await prisma.conversation.findFirst({
    where: {
      type: 'DM',
      AND: [
        { participants: { some: { userId: roshan.id } } },
        { participants: { some: { userId: ava.id } } },
      ],
    },
  });
  if (!dm) {
    dm = await prisma.conversation.create({
      data: {
        type: 'DM',
        participants: { create: [{ userId: roshan.id }, { userId: ava.id }] },
      },
    });
    await prisma.message.createMany({
      data: [
        { conversationId: dm.id, authorId: ava.id, content: 'yo you up for a game tonight?' },
        { conversationId: dm.id, authorId: roshan.id, content: 'always. same time as usual?' },
      ],
    });
  }

  // A party
  const existingParty = await prisma.party.findFirst({ where: { ownerId: roshan.id } });
  if (!existingParty) {
    const voiceRoom = await prisma.voiceRoom.create({
      data: { kind: 'PARTY', livekitName: `party-seed-${roshan.id.slice(0, 8)}` },
    });
    await prisma.party.create({
      data: {
        name: "Roshan's Party",
        game: 'Valorant',
        region: 'NA East',
        ownerId: roshan.id,
        voiceRoomId: voiceRoom.id,
        members: {
          create: [
            { userId: roshan.id, role: PartyMemberRole.LEADER },
            { userId: ava.id, role: PartyMemberRole.MEMBER },
          ],
        },
      },
    });
  }

  // A community with channels, roles, an event, and an announcement
  let community = await prisma.community.findFirst({ where: { ownerId: roshan.id } });
  if (!community) {
    community = await prisma.community.create({
      data: {
        name: 'Ascendant Collective',
        tag: 'ASND',
        ownerId: roshan.id,
        members: {
          create: [{ userId: roshan.id }, { userId: ava.id }, { userId: kofi.id }],
        },
        roles: {
          create: [
            { name: 'Founder', color: '#f2691c', permissions: ['ADMINISTRATOR'], position: 0 },
            { name: 'Member', color: '#9aa0a8', permissions: ['SEND_MESSAGES', 'JOIN_VOICE'], position: 1 },
          ],
        },
        channelGroups: {
          create: [
            {
              name: 'Text',
              position: 0,
              channels: { create: [{ name: 'general', type: ChannelType.TEXT, position: 0 }] },
            },
            {
              name: 'Voice',
              position: 1,
              channels: { create: [{ name: 'Main Lobby', type: ChannelType.VOICE, position: 0 }] },
            },
          ],
        },
        events: {
          create: [
            {
              title: 'Ranked Night — 5-stack scrims',
              game: 'Valorant',
              date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        announcements: {
          create: [
            {
              title: 'Season 3 kicks off Friday',
              body: 'New ranked season, new rewards track, and a refreshed map rotation land Friday at reset.',
              authorId: roshan.id,
            },
          ],
        },
      },
    });
  }

  console.log('Seed complete:', {
    users: [roshan.handle, ava.handle, kofi.handle],
    community: community.name,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
