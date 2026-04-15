const { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder } = require('discord.js');

const vouches = {};

function getVouches(userId) {
  return vouches[userId] ?? 0;
}

function addVouch(userId) {
  vouches[userId] = (vouches[userId] ?? 0) + 1;
  return vouches[userId];
}

const commands = [
  new SlashCommandBuilder()
    .setName('vouch')
    .setDescription('Add a vouch to a user')
    .addUserOption(option =>
      option.setName('user').setDescription('The user to vouch for').setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('show')
    .setDescription('Show how many vouches a user has')
    .addUserOption(option =>
      option.setName('user').setDescription('The user to check').setRequired(true)
    )
    .toJSON(),
];

let commandsRegistered = false;

async function registerSlashCommands(token, clientId) {
  if (commandsRegistered) return;
  try {
    const rest = new REST().setToken(token);
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    commandsRegistered = true;
    console.log('Slash commands registered globally');
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }
}

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) { console.error('DISCORD_TOKEN missing!'); process.exit(1); }

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  await registerSlashCommands(TOKEN, readyClient.user.id);
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.content.startsWith(',vouch ')) return;
    const mentioned = message.mentions.users.first();
    if (!mentioned) { await message.reply('Please mention a user to vouch for.'); return; }
    if (mentioned.id === message.author.id) { await message.reply('You cannot vouch for yourself.'); return; }
    const total = addVouch(mentioned.id);
    await message.reply(`${mentioned.displayName} now has ${total} vouch${total === 1 ? '' : 'es'}.`);
  } catch (err) { console.error('Error handling message command:', err); }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === 'vouch') {
      const target = interaction.options.getUser('user', true);
      if (target.id === interaction.user.id) { await interaction.reply({ content: 'You cannot vouch for yourself.', ephemeral: true }); return; }
      if (target.bot) { await interaction.reply({ content: 'You cannot vouch for a bot.', ephemeral: true }); return; }
      const total = addVouch(target.id);
      await interaction.reply(`${target.displayName} now has ${total} vouch${total === 1 ? '' : 'es'}.`);
    }
    if (interaction.commandName === 'show') {
      const target = interaction.options.getUser('user', true);
      const total = getVouches(target.id);
      await interaction.reply(`${target.displayName} has ${total} vouch${total === 1 ? '' : 'es'}.`);
    }
  } catch (err) {
    console.error('Error handling slash command:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Something went wrong.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(TOKEN);
