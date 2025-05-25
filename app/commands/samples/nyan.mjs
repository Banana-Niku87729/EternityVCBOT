import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('ping確認');

export async function execute(interaction){
	await interaction.reply('Botは応答中です');
}
