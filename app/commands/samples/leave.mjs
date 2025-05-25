import { SlashCommandBuilder } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";

export const data = new SlashCommandBuilder()
  .setName("leave")
  .setDescription("ボイスチャンネルから退出します");

export async function execute(interaction) {
  const connection = getVoiceConnection(interaction.guild.id);

  if (!connection) {
    return await interaction.reply("ボイスチャンネルに接続していません！");
  }

  connection.destroy();
  await interaction.reply("ボイスチャンネルから退出しました！");
}
