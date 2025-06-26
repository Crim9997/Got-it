const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('free-access')
    .setDescription('Get free access by following the requirements and get your role!')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Your Roblox username')
        .setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();

    const username = interaction.options.getString('username');
    const requiredShirtIds = [17180786881, 17495684302]; 
    const requiredPantIds = [17452059275, 17495737611, 18658268290, 18658305143]; 
    const roleId = '1309964463943716894';

    try {
      const userId = await noblox.getIdFromUsername(username);
      const userGroups = await noblox.getGroups(userId);
      const playerInfo = await noblox.getPlayerInfo(userId);
      const avatar = await noblox.getPlayerThumbnail([userId], "150x150", "png", false, "Headshot");

      const isWearingShirt = await Promise.any(requiredShirtIds.map(id => noblox.getPlayerOutfit(userId).then(outfit => outfit.assets.some(asset => asset.id === id))));
      const isWearingPant = await Promise.any(requiredPantIds.map(id => noblox.getPlayerOutfit(userId).then(outfit => outfit.assets.some(asset => asset.id === id))));

      if (!playerInfo.displayName.includes('EOK')) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('⚠️ Display Name Requirement Not Met')
          .setDescription('You must have **EOK** in your **display name** to get free access.')
          .setThumbnail(avatar[0].imageUrl)
          .setFooter({ text: 'Free Access Verification' });
        return await interaction.editReply({ embeds: [embed] });
      }

      if (!isWearingShirt || !isWearingPant) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('⚠️ Outfit Requirement Not Met')
          .setDescription('You must be wearing one of the **required shirts** and one of the **required pants**.')
          .setThumbnail(avatar[0].imageUrl)
          .setFooter({ text: 'Free Access Verification' });
        return await interaction.editReply({ embeds: [embed] });
      }

      const role = interaction.guild.roles.cache.get(roleId);
      const member = interaction.guild.members.cache.get(interaction.user.id);
      await member.roles.add(role);

      const successEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Access Granted')
        .setDescription(`You have successfully received the <@&${roleId}> role!`)
        .setThumbnail(avatar[0].imageUrl)
        .setFooter({ text: 'Welcome!' });

      return await interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
      console.error(error);
      return await interaction.editReply('❌ An error occurred while processing your request. Please make sure your username is correct.');
    }
  },
};
