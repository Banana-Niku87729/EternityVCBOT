import { SlashCommandBuilder } from "discord.js";
import { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior, VoiceConnectionStatus, getVoiceConnection, entersState, AudioPlayerStatus } from "@discordjs/voice";
import fs from 'node:fs';
import path from 'node:path';

export const data = new SlashCommandBuilder()
  .setName("join")
  .setDescription("指定したVCに参加する")
  .addStringOption(option =>
    option.setName("vc")
      .setDescription("参加するVCの名前")
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply(); // 処理に時間がかかる可能性があるため応答を遅延する
  
  try {
    const vcName = interaction.options.getString("vc");
    const guild = interaction.guild;
    
    // VCを探す（名前またはID）
    let channel = guild.channels.cache.find(ch => 
      (ch.name === vcName || ch.id === vcName) && ch.type === 2
    );
    
    if (!channel) {
      return interaction.editReply({ content: `VC「${vcName}」が見つかりません。`, ephemeral: true });
    }
    
    // すでに接続されているかチェック
    const existingConnection = getVoiceConnection(guild.id);
    if (existingConnection) {
      existingConnection.destroy();
    }
    
    // VCに接続
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });
    
    // 接続状態の監視
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        console.log('VCから切断されました。再接続を試みます...');
        // 自動再接続を試みる
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        console.log('再接続プロセスを開始しました');
      } catch (error) {
        // 再接続に失敗した場合は接続を破棄
        console.error('再接続に失敗しました:', error);
        connection.destroy();
      }
    });
    
    // オーディオプレイヤーの設定
    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play, // 購読者がいなくても再生を続ける
      },
    });
    
    // 無音ファイルをループ再生する関数
    const playSilentAudio = () => {
      try {
        // CDNの無音ファイルを使用
        const silentMp3Url = "https://cdn.glitch.global/8b0c65fc-4a9a-46a7-99e5-3870a1d82799/silent.ogg?v=1739598570328";
        const resource = createAudioResource(silentMp3Url);
        player.play(resource);
      } catch (error) {
        console.error('無音ファイルの再生に失敗しました:', error);
      }
    };
    
    // オーディオの再生が終了したらまた再生する
    player.on(AudioPlayerStatus.Idle, () => {
      console.log('無音ファイルの再生が終了しました。再度再生します...');
      playSilentAudio();
    });
    
    // 接続が確立した後に処理
    connection.on(VoiceConnectionStatus.Ready, () => {
      // 接続成功メッセージを送信
      interaction.editReply({ content: `VC「${channel.name}」に接続しました！` });
      
      // 最初の無音ファイル再生を開始
      playSilentAudio();
      
      // プレイヤーをVCに接続
      connection.subscribe(player);
    });
    
    // エラーハンドリング
    connection.on(VoiceConnectionStatus.Error, (error) => {
      console.error(`VC接続エラー:`, error);
      interaction.followUp({ content: `VC接続中にエラーが発生しました`, ephemeral: true })
        .catch(console.error);
    });
    
    // 10秒後も接続されていない場合は完全に切断と判断
    setTimeout(() => {
      if (connection.state.status !== VoiceConnectionStatus.Ready) {
        connection.destroy();
        interaction.followUp({ content: 'VCへの接続に失敗しました。別のVCを試すか、後でもう一度お試しください。', ephemeral: true })
          .catch(console.error);
      }
    }, 10000);
    
  } catch (error) {
    console.error('コマンド実行エラー:', error);
    // すでに応答済みの場合はfollowUpを使用
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `エラーが発生しました: ${error.message}`, ephemeral: true })
        .catch(console.error);
    } else {
      await interaction.reply({ content: `エラーが発生しました: ${error.message}`, ephemeral: true })
        .catch(console.error);
    }
  }
}