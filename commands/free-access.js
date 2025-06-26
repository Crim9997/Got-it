const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

async function getRobloxAvatarThumbnail(userId) {
    const url = https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true;
    const response = await axios.get(url);
    return response.data?.data?.[0]?.imageUrl || null;
}

class VerificationManager {
    constructor() {
        this.storage = new Map(); 
        this.filePath = path.join(__dirname, 'discord_verification_map_free.json');
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
            
            console.log(✅ Loaded ${loadedCount} active free access verification mappings);
        } catch (error) {
            console.log('📁 Creating new free access verification mapping file');
        }
    }

    async saveToFile() {
        try {
            const dataToSave = Object.fromEntries(this.storage);
            await fs.writeFile(this.filePath, JSON.stringify(dataToSave, null, 2));
        } catch (error) {
            console.error('❌ Error saving free access verification map:', error);
        }
    }

    generateCode(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = 'VERIFY-';
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
            console.log(✅ Free Access Verified: Discord ${discordUserId} -> Roblox ${userData.robloxUsername} (${userData.robloxUserId}));
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
            console.log(🧹 Cleaned ${cleaned} expired free access verification codes);
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

            console.log(🔍 Checking free access verification for Discord: ${discordUserId} -> Roblox: ${username} (${userId}));

 
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
            if (!displayName.startsWith('EOK_')) {
                const warningEmbed = new EmbedBuilder()
                    .setColor('#ff3c3c') 
                    .setTitle('🚫 Access Denied')
                    .setDescription(
                        Hey <@${discordUserId}>, you don’t meet the **free access requirements**. Please follow the steps below to proceed:\n\n +
                        **🔍 Current Status:**\n +
                        > **Display Name:** \${displayName}\\n +
                        > ❌ Must start with \EOK_\\n\n +
                        **✅ How to Get Free Access:**\n +
                        1️⃣ Change your Roblox **display name** to start with \EOK_\\n +
                        2️⃣ Wear one of the **required shirts**\n> IDs: \${requiredShirtIds.join(', ')}\\n +
                        3️⃣ Wear one of the **required pants**\n> IDs: \${requiredPantIds.join(', ')}\\n +
                        4️⃣ Run this command again\n\n +
                        💡 *Make sure all requirements are fulfilled before retrying.*
                    )
                    .setThumbnail('https://i.ibb.co/G4QG69r2/devil.webp')
                    .setImage('https://i.ibb.co/mrRHYC1w/roblox-logo-q0l1nrm00k6r29kz.jpg')
                    .setFooter({ text: Checked Discord ID: ${discordUserId} })
                    .setTimestamp();
            
                return await interaction.editReply({ embeds: [warningEmbed] });
            }
            

        
            const verificationData = verificationManager.getVerificationData(discordUserId, userId, username);
            let isVerified = false;

            try {
                const description = playerInfo.blurb || '';
                isVerified = verificationManager.checkVerification(discordUserId, description);

                if (isVerified) {
                    console.log(✅ Account verified for Discord user ${discordUserId});
                    const verifiedData = verificationManager.markVerified(discordUserId);
                } else {
                    const verifyEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🔐 Account Verification Required')
                        .setDescription(
                            **Hey <@${discordUserId}>! To verify you own this Roblox account:**\n\n +
                            1. Go to your [Roblox Profile](https://www.roblox.com/users/${userId}/profile)\n +
                            2. Click "Edit Profile"\n +
                            3. Add this code to your **About/Description**:\n +
                            \\\${verificationData.code}\\\\n +
                            4. Save your profile\n +
                            5. Run this command again\n\n +
                            ⏱️ **Code expires in ${verificationData.timeRemaining} minutes**\n +
                            ${verificationData.isNewCode ? '🆕 **New code generated**' : '🔄 **Same code as before**'}\n\n +
                            *You can remove the code after verification is complete.*
                        )
                        .setFooter({ text: Mapped to Discord ID: ${discordUserId} })
                        .setTimestamp();

                    return await interaction.editReply({ embeds: [verifyEmbed] });
                }
            } catch (error) {
                console.error('Error in verification process:', error);
                return await interaction.editReply({
                    content: '❌ Could not complete verification process. Please try again later.',
                });
            }


            console.log(🔍 Checking currently wearing items for ${username} (ID: ${userId}));

            let currentlyWearing;
            try {
                currentlyWearing = await noblox.getCurrentlyWearing(userId);
            } catch (error) {
                console.error('Error fetching currently wearing items:', error);
                return await interaction.editReply({
                    content: '❌ Could not fetch your currently wearing items. Please make sure your profile is public.',
                });
            }

            console.log(👕 Currently wearing items:, currentlyWearing);

        
            let hasRequiredShirt = false;
            let hasRequiredPants = false;
            let foundShirtId = null;
            let foundPantId = null;

            if (currentlyWearing && currentlyWearing.length > 0) {
                for (const item of currentlyWearing) {
                    const assetId = item.assetId || item.id || item.assetID || item.ID;
                    const assetType = item.assetType || item.type;
                    
                    console.log(👔 Item: ID = ${assetId}, Type = ${assetType});
                    
             
                    if ((assetType === 'Shirt' || assetType === 11)) {
                        for (const shirtId of requiredShirtIds) {
                            if (assetId === shirtId || assetId == shirtId || Number(assetId) === Number(shirtId)) {
                                hasRequiredShirt = true;
                                foundShirtId = assetId;
                                console.log(✅ Required shirt found: ${assetId});
                                break;
                            }
                        }
                    }
                    
                  
                    if ((assetType === 'Pants' || assetType === 12)) {
                        for (const pantId of requiredPantIds) {
                            if (assetId === pantId || assetId == pantId || Number(assetId) === Number(pantId)) {
                                hasRequiredPants = true;
                                foundPantId = assetId;
                                console.log(✅ Required pants found: ${assetId});
                                break;
                            }
                        }
                    }
                }
            }

        
            if (!hasRequiredShirt || !hasRequiredPants) {
                const missingItems = [];
                if (!hasRequiredShirt) missingItems.push(👕 Any required shirt (IDs: ${requiredShirtIds.join(', ')}));
                if (!hasRequiredPants) missingItems.push(👖 Any required pants (IDs: ${requiredPantIds.join(', ')}));

                const warningEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Requirements Not Met')
                    .setDescription(
                        **Hey <@${discordUserId}>! You don't meet all the free access requirements:**\n\n +
                        🎮 **Roblox Account:** ${username} (${userId})\n +
                        ✅ **Display Name:** ${displayName} (starts with EOK_)\n +
                        ❌ **Missing Items:** ${missingItems.join(', ')}\n\n +
                        **To get free access, you must:**\n +
                        1. ✅ Change your display name to start with "EOK_"\n +
                        2. ${hasRequiredShirt ? '✅' : '❌'} Wear any required shirt (IDs: ${requiredShirtIds.join(', ')})\n +
                        3. ${hasRequiredPants ? '✅' : '❌'} Wear any required pants (IDs: ${requiredPantIds.join(', ')})\n +
                        4. Run this command again\n\n +
                        *Please complete all requirements and try again.*
                    )
                    .setThumbnail('https://i.ibb.co/G4QG69r2/devil.webp')
                    .setImage('https://i.ibb.co/mrRHYC1w/roblox-logo-q0l1nrm00k6r29kz.jpg')
                    .setFooter({ text: Checked for Discord ID: ${discordUserId} })
                    .setTimestamp();

                return await interaction.editReply({ embeds: [warningEmbed] });
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
                    content: ✅ You already have the **${role.name}** role!,
                });
            }

    
            await member.roles.add(role);
            console.log(✅ Gave free access role ${role.name} to Discord user ${discordUserId});

        
            let robloxRankResult = '';
            try {
                if (groupId) {
                    const currentUser = await noblox.getCurrentUser();
                    const botUserId = currentUser.UserID;
                    
                    if (userId === botUserId) {
                        robloxRankResult = '\n🤖 **Bot account detected - Discord role given!**';
                        console.log(ℹ️ Skipped ranking for bot account ${username});
                    } else {
                        await noblox.setRank(groupId, userId, robloxRankId);
                        robloxRankResult = '\n🎯 **Roblox rank updated successfully!**';
                        console.log(✅ Updated Roblox rank for ${username} to ${robloxRankId});
                    }
                }
            } catch (rankError) {
                console.error('❌ Roblox ranking error:', rankError);
                robloxRankResult = '\n⚠️ **Discord role given, but Roblox ranking failed.**';
            }

           
            const successEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Free Access Granted!')
                .setDescription(
                    **Welcome to free access, ${username}!**\n\n +
                    👤 **Discord:** <@${discordUserId}>\n +
                    🎮 **Roblox:** ${username} (${userId})\n +
                    🎭 **Display Name:** ${displayName}\n +
                    🎭 **Discord Role:** ${role.name}\n +
                    👕 **Shirt Verified:** ✅ (ID: ${foundShirtId})\n +
                    👖 **Pants Verified:** ✅ (ID: ${foundPantId})\n +
                    🔐 **Account Verified:** ✅${robloxRankResult}\n\n +
                    *You can now remove the verification code from your Roblox profile.*
                )
                .setThumbnail('https://i.ibb.co/G4QG69r2/devil.webp')
                .setImage('https://i.ibb.co/mrRHYC1w/roblox-logo-q0l1nrm00k6r29kz.jpg')
                .setTimestamp();

            const thumbnail = await getRobloxAvatarThumbnail(userId);
            if (thumbnail) {
                successEmbed.setThumbnail(thumbnail);
            }
                
            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('❌ Free access command error:', error);
            await interaction.editReply({
                content: ❌ An error occurred while processing your request for **${username}**. Please try again later.\n\n*If this continues, contact an administrator.*,
            });
        }
    },
};
