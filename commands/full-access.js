const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

async function getRobloxAvatarThumbnail(userId) {
    const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true`;
    const response = await axios.get(url);
    return response.data?.data?.[0]?.imageUrl || null;
}

class VerificationManager {
    constructor() {
        this.storage = new Map();
        this.filePath = path.join(__dirname, 'discord_verification_map_full.json');
        this.timeout = 10 * 60 * 1000;
        this.loadFromFile();
    }


    async loadFromFile() {
        try {
            const data = await fs.readFile(this.filePath, 'utf8');
            const saved = JSON.parse(data);

            const now = Date.now();
            let loadedCount = 0;


            for (const [discordId, userData] of Object.entries(saved)) {
                if (now - userData.timestamp < this.timeout) {
                    this.storage.set(discordId, userData);
                    loadedCount++;
                }
            }

            console.log(`✅ Loaded ${loadedCount} active full-access verification mappings`);
        } catch (error) {
            console.log('📁 Creating new full-access verification mapping file');
        }
    }


    async saveToFile() {
        try {
            const dataToSave = Object.fromEntries(this.storage);
            await fs.writeFile(this.filePath, JSON.stringify(dataToSave, null, 2));
        } catch (error) {
            console.error('❌ Error saving full-access verification map:', error);
        }
    }


    generateCode(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = 'VERIFY-FULL-';
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }


    getVerificationData(discordUserId, robloxUserId, robloxUsername) {
        const now = Date.now();


        if (this.storage.has(discordUserId)) {
            const existing = this.storage.get(discordUserId);


            if (now - existing.timestamp < this.timeout && existing.robloxUserId === robloxUserId) {
                return {
                    code: existing.code,
                    isNewCode: false,
                    timeRemaining: Math.ceil((this.timeout - (now - existing.timestamp)) / 60000)
                };
            } else {

                this.storage.delete(discordUserId);
            }
        }


        const newCode = this.generateCode();
        const verificationData = {
            code: newCode,
            timestamp: now,
            robloxUserId: robloxUserId,
            robloxUsername: robloxUsername,
            verified: false
        };

        this.storage.set(discordUserId, verificationData);
        this.saveToFile();

        return {
            code: newCode,
            isNewCode: true,
            timeRemaining: 10
        };
    }


    checkVerification(discordUserId, profileDescription) {
        if (!this.storage.has(discordUserId)) {
            return false;
        }

        const userData = this.storage.get(discordUserId);
        const now = Date.now();


        if (now - userData.timestamp >= this.timeout) {
            this.storage.delete(discordUserId);
            this.saveToFile();
            return false;
        }


        return profileDescription.includes(userData.code);
    }


    markVerified(discordUserId) {
        if (this.storage.has(discordUserId)) {
            const userData = this.storage.get(discordUserId);
            console.log(`✅ Full-Access Verified: Discord ${discordUserId} -> Roblox ${userData.robloxUsername} (${userData.robloxUserId})`);
            this.storage.delete(discordUserId);
            this.saveToFile();
            return userData;
        }
        return null;
    }


    cleanExpired() {
        const now = Date.now();
        let cleaned = 0;

        for (const [discordId, userData] of this.storage.entries()) {
            if (now - userData.timestamp >= this.timeout) {
                this.storage.delete(discordId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} expired full-access verification codes`);
            this.saveToFile();
        }

        return cleaned;
    }
}


const verificationManager = new VerificationManager();


setInterval(() => {
    verificationManager.cleanExpired();
}, 5 * 60 * 1000);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('full-access')
        .setDescription('Check if you own the full access shirt and get your role!')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Your Roblox username')
                .setRequired(true)
        ),
    async execute(interaction) {

        await interaction.deferReply();

        const username = interaction.options.getString('username');
        const shirtId = 8902806997;
        const roleId = '1309964453403557920';
        const robloxRankId = 101215413;
        const groupId = process.env.ROBLOX_GROUP_ID;
        const discordUserId = interaction.user.id;

        try {

            const userId = await noblox.getIdFromUsername(username);
            if (!userId) {
                return await interaction.editReply({
                    content: '❌ Roblox username not found. Please check your spelling.',
                });
            }

            console.log(`🔍 Checking full-access verification for Discord: ${discordUserId} -> Roblox: ${username} (${userId})`);


            const verificationData = verificationManager.getVerificationData(discordUserId, userId, username);
            let isVerified = false;

            try {
                const playerInfo = await noblox.getPlayerInfo(userId);
                const description = playerInfo.blurb || '';


                isVerified = verificationManager.checkVerification(discordUserId, description);

                if (isVerified) {
                    console.log(`✅ Full-access account verified for Discord user ${discordUserId}`);

                    const verifiedData = verificationManager.markVerified(discordUserId);
                } else {
                    const verifyEmbed = new EmbedBuilder()
                        .setColor('#ffff00')
                        .setTitle('🔐 Account Verification Required')
                        .setDescription(
                            `**Hey <@${discordUserId}>! To verify you own this Roblox account:**\n\n` +
                            `1. Go to your [Roblox Profile](https://www.roblox.com/users/${userId}/profile)\n` +
                            `2. Click "Edit Profile"\n` +
                            `3. Add this code to your **About/Description**:\n` +
                            `\`\`\`${verificationData.code}\`\`\`\n` +
                            `4. Save your profile\n` +
                            `5. Run this command again\n\n` +
                            `⏱️ **Code expires in ${verificationData.timeRemaining} minutes**\n` +
                            `${verificationData.isNewCode ? '🆕 **New code generated**' : '🔄 **Same code as before**'}\n\n` +
                            `*You can remove the code after verification is complete.*`
                        )
                        .setThumbnail('https://i.ibb.co/G4QG69r2/devil.webp')
                        .setImage('https://cdn.discordapp.com/attachments/1309951566953975828/1388452088236871771/ca105410be2d80cc00c1ab2393ab063b.png?ex=68610846&is=685fb6c6&hm=228ca9d5195deddc56f0ecb34162fff529c1fe08cf7e2121e43f583df5248c59&')
                        .setFooter({ text: `Mapped to Discord ID: ${discordUserId}` })
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [verifyEmbed] });
                }
            } catch (error) {
                console.error('Error fetching player info:', error);
                return await interaction.editReply({
                    content: '❌ Could not fetch Roblox profile information. Please try again later.',
                });
            }


            console.log(`🔍 Checking shirt inventory for ${username} (ID: ${userId}), looking for shirt: ${shirtId}`);

            let inventory;
            try {
                inventory = await noblox.getInventory({
                    userId: userId,
                    assetTypes: ['Shirt'],
                    sortOrder: 'Asc',
                    limit: 100
                });
            } catch (error) {
                if (error.message.includes('private') || error.message.includes('403') || error.message.includes('401')) {
                    return await interaction.editReply({
                        content: '🔒 **Make your inventory visible for everyone**\n\nYour Roblox inventory is currently private. Please make it public so we can verify your shirt ownership.',
                    });
                }
                throw error;
            }


            let shirts = [];
            if (inventory.data) {
                shirts = inventory.data;
                console.log(`📦 Found ${shirts.length} items in inventory.data`);
            } else if (Array.isArray(inventory)) {
                shirts = inventory;
                console.log(`📦 Found ${shirts.length} items in inventory array`);
            } else {
                console.log('❓ Unexpected inventory structure:', inventory);
            }

            let ownsShirt = false;
            if (shirts.length > 0) {
                console.log(`👕 Found ${shirts.length} shirts in inventory`);


                shirts.slice(0, 3).forEach((item, index) => {
                    const assetId = item.assetId || item.id || item.assetID || item.ID;
                    console.log(`👕 Shirt ${index + 1}: ID = ${assetId} (type: ${typeof assetId}), Target: ${shirtId} (type: ${typeof shirtId})`);
                });


                ownsShirt = shirts.some(item => {
                    const assetId = item.assetId || item.id || item.assetID || item.ID;


                    const strictMatch = assetId === shirtId;
                    const looseMatch = assetId == shirtId;
                    const stringMatch = String(assetId) === String(shirtId);
                    const numberMatch = Number(assetId) === Number(shirtId);

                    if (strictMatch || looseMatch || stringMatch || numberMatch) {
                        console.log(`✅ SHIRT FOUND! Asset ID: ${assetId}, Target: ${shirtId}`);
                        return true;
                    }
                    return false;
                });

                console.log(`👕 Shirt ownership result: ${ownsShirt}`);
            } else {
                console.log('❌ No shirts found in inventory');
            }

            if (!ownsShirt) {
                const embed = new EmbedBuilder()
                    .setColor('#ffff00')
                    .setTitle('❌ Access Denied')
                    .setDescription(
                        `**You don't own the required full access shirt!**\n\n` +
                        `🎮 **Roblox Account:** ${username} (${userId})\n` +
                        `👤 **Discord:** <@${discordUserId}>\n` +
                        `👕 **Required Shirt ID:** ${shirtId}\n\n` +
                        `*Make sure your inventory is public and you own the shirt. If you think this is an error, contact an administrator.*`
                    )
                    .setThumbnail('https://i.ibb.co/G4QG69r2/devil.webp')
                    .setImage('https://i.ibb.co/mrRHYC1w/roblox-logo-q0l1nrm00k6r29kz.jpg')
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed] });
            }


            const member = interaction.member;
            const role = interaction.guild.roles.cache.get(roleId);

            if (!role) {
                return await interaction.editReply({
                    content: '❌ Role not found. Please contact an administrator.',
                });
            }

            if (member.roles.cache.has(roleId)) {
                return await interaction.editReply({
                    content: `✅ You already have the **${role.name}** role!`,
                });
            }


            await member.roles.add(role);
            console.log(`✅ Gave role ${role.name} to Discord user ${discordUserId}`);


            let robloxRankResult = '';
            try {
                if (groupId) {

                    const currentUser = await noblox.getCurrentUser();
                    const botUserId = currentUser.UserID;

                    if (userId === botUserId) {
                        robloxRankResult = '\n🤖 **Bot account detected - Discord role given!**';
                        console.log(`ℹ️ Skipped ranking for bot account ${username}`);
                    } else {
                        await noblox.setRank(groupId, userId, robloxRankId);
                        robloxRankResult = '\n🎯 **Roblox rank updated successfully!**';
                        console.log(`✅ Updated Roblox rank for ${username} to ${robloxRankId}`);
                    }
                }
            } catch (rankError) {
                console.error('❌ Roblox ranking error:', rankError);
                robloxRankResult = '\n⚠️ **Discord role given, but Roblox ranking failed.**';
            }


            const successEmbed = new EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('✅ Full Access Granted!')
                .setDescription(
                    `**Welcome to full access, ${username}!**\n\n` +
                    `👤 **Discord:** <@${discordUserId}>\n` +
                    `🎮 **Roblox:** ${username} (${userId})\n` +
                    `🎭 **Discord Role:** ${role.name}\n` +
                    `👕 **Shirt Verified:** ✅ (ID: ${shirtId})\n` +
                    `🔐 **Account Verified:** ✅${robloxRankResult}\n\n` +
                    `*You can now remove the verification code from your Roblox profile.*`
                )
                .setImage('https://i.ibb.co/mrRHYC1w/roblox-logo-q0l1nrm00k6r29kz.jpg')
                .setTimestamp();

            const thumbnail = await getRobloxAvatarThumbnail(userId);
            if (thumbnail) {
                successEmbed.setThumbnail(thumbnail);
            }

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('❌ Full access command error:', error);
            await interaction.editReply({
                content: `❌ An error occurred while processing your request for **${username}**. Please try again later.\n\n*If this continues, contact an administrator.*`,
            });
        }
    },
};
