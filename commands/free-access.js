const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

// ... other utility functions (unchanged)
async function getRobloxAvatarThumbnail(userId) {
    const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true`;
    const response = await axios.get(url);
    return response.data?.data?.[0]?.imageUrl || null;
}

// ... VerificationManager class (unchanged)

const verificationManager = new VerificationManager();

setInterval(() => {
    verificationManager.cleanExpired();
}, 5 * 60 * 1000);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('free-access')
        .setDescription('Get free access by following the requirements and get your role!')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Your Roblox username')
                .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply();

        const username = interaction.options.getString('username');
        const requiredShirtIds = [17180786881, 17495684302]; 
        const requiredPantIds = [17452059275, 17495737611, 18658268290, 18658305143]; 
        const roleId = '1309964463943716894'; 
        const robloxRankId = 101215424; 
        const groupId = process.env.ROBLOX_GROUP_ID;
        const discordUserId = interaction.user.id;

        try {
            const userId = await noblox.getIdFromUsername(username);
            if (!userId) {
                return await interaction.editReply({
                    content: '❌ Roblox username not found. Please check your spelling.',
                });
            }

            console.log(`🔍 Checking free access verification for Discord: ${discordUserId} -> Roblox: ${username} (${userId})`);

            let playerInfo;
            try {
                playerInfo = await noblox.getPlayerInfo(userId);
            } catch (error) {
                console.error('Error fetching player info:', error);
                return await interaction.editReply({
                    content: '❌ Could not fetch Roblox profile information. Please try again later.',
                });
            }

            const displayName = playerInfo.displayName || playerInfo.username || username;
            if (!displayName.includes('EOK')) {
                const warningEmbed = new EmbedBuilder()
                    .setColor('#ff3c3c') 
                    .setTitle('🚫 Access Denied')
                    .setDescription(
                        `Hey <@${discordUserId}>, you don’t meet the **free access requirements**. Please follow the steps below to proceed:\n\n` +
                        `**🔍 Current Status:**\n` +
                        `> **Display Name:** \`${displayName}\`\n` +
                        `> ❌ Must contain \`EOK\` anywhere in the display name\n\n` +
                        `**✅ How to Get Free Access:**\n` +
                        `1️⃣ Change your Roblox **display name** to contain \`EOK\`\n` +
                        `2️⃣ Wear one of the **required shirts**\n> IDs: \`${requiredShirtIds.join(', ')}\`\n` +
                        `3️⃣ Wear one of the **required pants**\n> IDs: \`${requiredPantIds.join(', ')}\`\n` +
                        `4️⃣ Run this command again\n\n` +
                        `💡 *Make sure all requirements are fulfilled before retrying.*`
                    )
                    .setThumbnail('https://i.ibb.co/G4QG69r2/devil.webp')
                    .setImage('https://i.ibb.co/mrRHYC1w/roblox-logo-q0l1nrm00k6r29kz.jpg')
                    .setFooter({ text: `Checked Discord ID: ${discordUserId}` })
                    .setTimestamp();

                return await interaction.editReply({ embeds: [warningEmbed] });
            }

            // ... rest of the code remains unchanged (includes verification, clothing check, role assignment, etc.)
        } catch (error) {
            console.error('❌ Free access command error:', error);
            await interaction.editReply({
                content: `❌ An error occurred while processing your request for **${username}**. Please try again later.\n\n*If this continues, contact an administrator.*`,
            });
        }
    },
};
