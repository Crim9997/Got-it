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
        this.filePath = path.join(__dirname, 'discord_verification_map_half.json');
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

            console.log(`✅ Loaded ${loadedCount} active half access verification mappings`);
        } catch (error) {
            console.log('📁 Creating new half access verification mapping file');
        }
    }


    async saveToFile() {
        try {
            const dataToSave = Object.fromEntries(this.storage);
            await fs.writeFile(this.filePath, JSON.stringify(dataToSave, null, 2));
        } catch (error) {
            console.error('❌ Error saving half access verification map:', error);
        }
    }


    generateCode(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = 'HALF-VERIFY-';
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
            console.log(`✅ Half Access Verified: Discord ${discordUserId} -> Roblox ${userData.robloxUsername} (${userData.robloxUserId})`);
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
            console.log(`🧹 Cleaned ${cleaned} expired half access verification codes`);
            this.saveToFile();
        }

        return cleaned;
    }
}


const halfAccessVerificationManager = new VerificationManager();


setInterval(() => {
    halfAccessVerificationManager.cleanExpired();
}, 5 * 60 * 1000);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('half-access')
        .setDescription('Check if you own the half access shirt and get your role!')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Your Roblox username')
                .setRequired(true)
        ),
    async execute(interaction) {

        await interaction.deferReply();

        const username = interaction.options.getString('username');
        const shirtId = 8902806997;
        const roleId = '1309964460177363005';
        const robloxRankId = 101215367;
        const groupId = process.env.ROBLOX_GROUP_ID;
        const discordUserId = interaction.user.id;

        try {

            const userId = await noblox.getIdFromUsername(username);
            if (!userId) {
                const notFoundEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('❌ Username Not Found')
                    .setDescription(
                        `**Roblox username "${username}" was not found.**\n\n` +
                        `Please check your spelling and try again.\n\n` +
                        `*Make sure you're using your exact Roblox username.*`
                    )
                    .setThumbnail('https://i.ibb.co/G4QG69r2/devil.webp')
                    .setImage('https://i.ibb.co/mrRHYC1w/roblox-logo-q0l1nrm00k6r29kz.jpg')
                    .setTimestamp();

                return await interaction.editReply({ embeds: [notFoundEmbed] });
            }

            console.log(`🔍 Checking half access verification for Discord: ${discordUserId} -> Roblox: ${username} (${userId})`);


            const verificationData = halfAccessVerificationManager.getVerificationData(discordUserId, userId, username);
            let isVerified = false;

            try {
                const playerInfo = await noblox.getPlayerInfo(userId);
                const description = playerInfo.blurb || '';


                isVerified = halfAccessVerificationManager.checkVerification(discordUserId, description);

                if (isVerified) {
                    console.log(`✅ Half Access account verified for Discord user ${discordUserId}`);

                    const verifiedData = halfAccessVerificationManager.markVerified(discordUserId);
                } else {
                    const thumbnail = await getRobloxAvatarThumbnail(userId);

                    const verifyEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('🔐 Account Verification Required')
                        .setDescription(
                            `**Hey <@${discordUserId}>! To verify you own this Roblox account:**\n\n` +
                            `**1.** Go to your [Roblox Profile](https://www.roblox.com/users/${userId}/profile)\n` +
                            `**2.** Click "Edit Profile"\n` +
                            `**3.** Add this code to your **About/Description**:\n` +
                            `\`\`\`${verificationData.code}\`\`\`\n` +
                            `**4.** Save your profile\n` +
                            `**5.** Run this command again\n\n` +
                            `⏱️ **Code expires in ${verificationData.timeRemaining} minutes**\n` +
                            `${verificationData.isNewCode ? '🆕 **New code generated**' : '🔄 **Same code as before**'}\n\n` +
                            `👤 **Roblox Account:** ${username} (${userId})\n` +
                            `👤 **Discord:** <@${discordUserId}>\n\n` +
                            `*You can remove the code after verification is complete.*`
                        )
                        .setThumbnail('https://i.ibb.co/G4QG69r2/devil.webp')
                        .setImage('https://i.ibb.co/mrRHYC1w/roblox-logo-q0l1nrm00k6r29kz.jpg')
                        .setFooter({ text: `Half Access Verification • Mapped to Discord ID: ${discordUserId}` })
                        .setTimestamp();

                    if (thumbnail) {
                        verifyEmbed.setThumbnail(thumbnail);
                    }

                    return await interaction.editReply({ embeds: [verifyEmbed] });
                }
            } catch (error) {
                console.error('Error fetching player info:', error);
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('❌ Profile Access Error')
                    .setDescription(
                        `**Could not fetch Roblox profile information.**\n\n` +
                        `This could be due to:\n` +
                        `• Roblox API issues\n` +
                        `• Network connectivity problems\n` +
                        `• Profile restrictions\n\n` +
                        `Please try again in a few moments.`
                    )
                    .setThumbnail('https://i.ibb.co/G4QG69r2/devil.webp')
                    .setImage('https://i.ibb.co/mrRHYC1w/roblox-logo-q0l1nrm00k6r29kz.jpg')
                    .setTimestamp();

                return await interaction.editReply({ embeds: [errorEmbed] });
            }


            console.log(`🔍 Checking half access shirt inventory for ${username} (ID: ${userId}), looking for shirt: ${shirtId}`);

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
                    const privateInventoryEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('🔒 Inventory Privacy Error')
                        .setDescription(
                            `**Your Roblox inventory is currently private.**\n\n` +
                            `To verify your shirt ownership:\n\n` +
                            `**1.** Go to your [Roblox Settings](https://www.roblox.com/my/account#!/privacy)\n` +
                            `**2.** Set "Inventory" to **"Everyone"**\n` +
                            `**3.** Save changes\n` +
                            `**4.** Run this command again\n\n` +
                            `👤 **Account:** ${username} (${userId})\n` +
                            `*Your inventory needs to be public for verification.*`
                        )
                        .setThumbnail('https://i.ibb.co/G4QG69r2/devil.webp')
                        .setImage('https://i.ibb.co/mrRHYC1w/roblox-logo-q0l1nrm00k6r29kz.jpg')
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [privateInventoryEmbed] });
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
                        console.log(`✅ HALF ACCESS SHIRT FOUND! Asset ID: ${assetId}, Target: ${shirtId}`);
                        return true;
                    }
                    return false;
                });

                console.log(`👕 Half access shirt ownership result: ${ownsShirt}`);
            } else {
                console.log('❌ No shirts found in inventory');
            }

            if (!ownsShirt) {
                const thumbnail = await getRobloxAvatarThumbnail(userId);

                const noShirtEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('❌ Half Access Denied')
                    .setDescription(
                        `**You don't own the required half access shirt!**\n\n` +
                        `🎮 **Roblox Account:** ${username} (${userId})\n` +
                        `👤 **Discord:** <@${discordUserId}>\n` +
                        `👕 **Required Shirt ID:** ${shirtId}\n` +
                        `🔐 **Account Verified:** ✅\n\n` +
                        `**To get half access:**\n` +
                        `• Purchase the required shirt from the Roblox catalog\n` +
                        `• Make sure your inventory is public\n` +
                        `• Run this command again\n\n` +
                        `*If you think this is an error, contact an administrator.*`
                    )
                    .setThumbnail('https://i.ibb.co/G4QG69r2/devil.webp')
                    .setImage('https://i.ibb.co/mrRHYC1w/roblox-logo-q0l1nrm00k6r29kz.jpg')
                    .setTimestamp();

                if (thumbnail) {
                    noShirtEmbed.setThumbnail(thumbnail);
                }

                return await interaction.editReply({ embeds: [noShirtEmbed] });
            }


            const member = interaction.member;
            const role = interaction.guild.roles.cache.get(roleId);

            if (!role) {
                const roleErrorEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('❌ Configuration Error')
                    .setDescription(
                        `**Half Access role not found in server.**\n\n` +
                        `Please contact an administrator to fix this issue.\n\n` +
                        `*Error: Role ID ${roleId} does not exist.*`
                    )
                    .setThumbnail('https://i.ibb.co/G4QG69r2/devil.webp')
                    .setImage('https://i.ibb.co/mrRHYC1w/roblox-logo-q0l1nrm00k6r29kz.jpg')
                    .setTimestamp();

                return await interaction.editReply({ embeds: [roleErrorEmbed] });
            }

            if (member.roles.cache.has(roleId)) {
                const thumbnail = await getRobloxAvatarThumbnail(userId);

                const alreadyHasRoleEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('✅ Already Have Access')
                    .setDescription(
                        `**You already have the Half Access role!**\n\n` +
                        `👤 **Discord:** <@${discordUserId}>\n` +
                        `🎮 **Roblox:** ${username} (${userId})\n` +
                        `🎭 **Role:** ${role.name}\n` +
                        `👕 **Shirt Verified:** ✅ (ID: ${shirtId})\n` +
                        `🔐 **Account Verified:** ✅\n\n` +
                        `*You're all set! Enjoy your half access privileges.*`
                    )
                    .setThumbnail('https://i.ibb.co/G4QG69r2/devil.webp')
                    .setImage('https://i.ibb.co/mrRHYC1w/roblox-logo-q0l1nrm00k6r29kz.jpg')
                    .setTimestamp();

                if (thumbnail) {
                    alreadyHasRoleEmbed.setThumbnail(thumbnail);
                }

                return await interaction.editReply({ embeds: [alreadyHasRoleEmbed] });
            }


            await member.roles.add(role);
            console.log(`✅ Gave half access role ${role.name} to Discord user ${discordUserId}`);

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


            const thumbnail = await getRobloxAvatarThumbnail(userId);

            const successEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('✅ Half Access Granted!')
                .setDescription(
                    `**Welcome to half access, ${username}!**\n\n` +
                    `👤 **Discord:** <@${discordUserId}>\n` +
                    `🎮 **Roblox:** ${username} (${userId})\n` +
                    `🎭 **Discord Role:** ${role.name}\n` +
                    `👕 **Shirt Verified:** ✅ (ID: ${shirtId})\n` +
                    `🔐 **Account Verified:** ✅${robloxRankResult}\n\n` +
                    `*You can now remove the verification code from your Roblox profile.*\n` +
                    `*Enjoy your half access privileges!*`
                )
                .setFooter({ text: 'Half Access System • Verification Complete' })
                .setImage('https://i.ibb.co/mrRHYC1w/roblox-logo-q0l1nrm00k6r29kz.jpg')
                .setTimestamp();

            if (thumbnail) {
                successEmbed.setThumbnail(thumbnail);
            }

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('❌ Half access command error:', error);

            const generalErrorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ System Error')
                .setDescription(
                    `**An error occurred while processing your request.**\n\n` +
                    `👤 **Username:** ${username}\n` +
                    `👤 **Discord:** <@${discordUserId}>\n\n` +
                    `**What to try:**\n` +
                    `• Wait a few moments and try again\n` +
                    `• Check if Roblox services are online\n` +
                    `• Contact an administrator if this continues\n\n` +
                    `*Error has been logged for review.*`
                )
                .setThumbnail('https://i.ibb.co/G4QG69r2/devil.webp')
                .setImage('https://i.ibb.co/mrRHYC1w/roblox-logo-q0l1nrm00k6r29kz.jpg')
                .setTimestamp();

            await interaction.editReply({ embeds: [generalErrorEmbed] });
        }
    },
};