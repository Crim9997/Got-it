const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
  } = require('discord.js');
  const noblox = require('noblox.js');
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName('check-inventory')
      .setDescription('Check what items are in a user\'s inventory')
      .addStringOption(option =>
        option.setName('username')
          .setDescription('Roblox username to check')
          .setRequired(true)
      ),
  
    async execute(interaction) {
      await interaction.deferReply(); 
      const username = interaction.options.getString('username');
  
      let userId;
      let allItems = [];
      let validAssetTypes = [];
      let invalidAssetTypes = [];
  
      try {
        userId = await noblox.getIdFromUsername(username);
        if (!userId) {
          return interaction.editReply({ content: '❌ Roblox username not found.' });
        }
  
    
        const assetTypesToTry = [
          'Shirt', 'Pants', 'TShirt', 'Hat', 'HairAccessory', 'FaceAccessory', 
          'NeckAccessory', 'ShoulderAccessory', 'FrontAccessory', 'BackAccessory', 
          'WaistAccessory', 'Gear', 'Face', 'Head', 'Package', 'Animation', 
          'EmoteAnimation', 'Badge', 'GamePass', 'Decal', 'Audio', 'Model', 'Place'
        ];
  
   
        await interaction.editReply({ 
          content: `🔍 Checking inventory for **${username}**...\n⏳ Scanning asset types (0/${assetTypesToTry.length})` 
        });
  
  
        for (let i = 0; i < assetTypesToTry.length; i++) {
          const assetType = assetTypesToTry[i];
          
       
          if (i % 5 === 0 || i === assetTypesToTry.length - 1) {
            await interaction.editReply({ 
              content: `🔍 Checking inventory for **${username}**...\n⏳ Scanning asset types (${i + 1}/${assetTypesToTry.length})\n📊 Found ${allItems.length} items so far` 
            });
          }
  
          try {
            const inventory = await noblox.getInventory({
              userId,
              assetTypes: [assetType],
              sortOrder: 'Asc',
              limit: 100
            });
  
            if (inventory) {
             
              const items = Array.isArray(inventory.data) ? inventory.data
                           : Array.isArray(inventory) ? inventory
                           : (inventory.data?.collectibleItems || []);
              
          
              const itemsWithType = items.map(item => ({
                ...item,
                assetType: assetType
              }));
              
              allItems = allItems.concat(itemsWithType);
              validAssetTypes.push(assetType);
            }
          } catch (invErr) {
            const msg = invErr.message.toLowerCase();
            if (msg.includes('private') || msg.includes('403') || msg.includes('401')) {
              
              continue;
            } else if (msg.includes('400') || msg.includes('invalid')) {
           
              invalidAssetTypes.push(assetType);
              continue;
            }
            throw invErr;
          }
        }
  
    
        await interaction.editReply({ 
          content: `✅ Scan complete! Processing ${allItems.length} items...` 
        });
  
      
        const itemsByType = {};
        allItems.forEach(item => {
          const type = item.assetType || 'Unknown';
          if (!itemsByType[type]) {
            itemsByType[type] = 0;
          }
          itemsByType[type]++;
        });
  
        const perPage = 10;
        const totalPages = Math.ceil(allItems.length / perPage) || 1;
        let currentPage = 0;
  
        if (allItems.length === 0) {
          return interaction.editReply({ 
            content: `📦 No items found in inventory.\n${validAssetTypes.length > 0 ? `✅ Checked: ${validAssetTypes.join(', ')}` : ''}${invalidAssetTypes.length > 0 ? `\n❌ Skipped invalid types: ${invalidAssetTypes.join(', ')}` : ''}` 
          });
        }
  
        const buildEmbed = page => {
          const start = page * perPage;
          const slice = allItems.slice(start, start + perPage);
  
          const list = slice.map((item, idx) => {
            const assetId = item.assetId || item.id || item.assetID || item.ID || 'Unknown';
            const name = item.name || item.assetName || 'Unknown Name';
            const type = item.assetType || 'Unknown Type';
            const emoji = getTypeEmoji(type);
            return `**${start + idx + 1}.** ${emoji} ${name}\n└ Type: \`${type}\` | ID: \`${assetId}\``;
          }).join('\n\n');
  
        
          const summary = Object.entries(itemsByType)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([type, count]) => `${getTypeEmoji(type)} ${type}: ${count}`)
            .join('\n');
  
          return new EmbedBuilder()
            .setColor('#0099ff')
            .setThumbnail('https://i.ibb.co/G4QG69r2/devil.webp')
            .setTitle(`🔍 ${username}'s Complete Inventory`)
            .setDescription(`**User ID:** ${userId}\n**Total Items:** ${allItems.length}\n**Showing ${start + 1}-${start + slice.length} of ${allItems.length}**`)
            .addFields(
              { 
                name: '📊 Top Item Types', 
                value: summary || 'No items', 
                inline: true 
              },
              { 
                name: '📋 Items', 
                value: list || 'No items to display',
                inline: false 
              }
            )
            .setFooter({ text: `Page ${page + 1} of ${totalPages} | Valid types: ${validAssetTypes.length}` })
            .setTimestamp();
        };
  
        const backButton = new ButtonBuilder()
          .setCustomId('back')
          .setLabel('⬅️ Back')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true);
  
        const nextButton = new ButtonBuilder()
          .setCustomId('next')
          .setLabel('➡️ Next')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(totalPages <= 1);
  
        const row = new ActionRowBuilder().addComponents(backButton, nextButton);
  
        await interaction.editReply({
          embeds: [buildEmbed(currentPage)],
          components: [row],
        });
  
        const collector = interaction.channel.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 120_000 
        });
  
        collector.on('collect', async btnInt => {
          if (btnInt.user.id !== interaction.user.id) {
            //return btnInt.reply({ content: "❌ These buttons aren't for you!", ephemeral: true });
          }
  
          if (btnInt.customId === 'next') {
            currentPage++;
          } else if (btnInt.customId === 'back') {
            currentPage--;
          }
  
          backButton.setDisabled(currentPage <= 0);
          nextButton.setDisabled(currentPage >= totalPages - 1);
  
          await btnInt.update({
            embeds: [buildEmbed(currentPage)],
            components: [row],
          });
        });
  
        collector.on('end', async () => {
            try {
              await interaction.editReply({
                components: [] 
              });
            } catch (err) {
              console.warn('Could not remove buttons after collector end:', err.message);
            }
          });
          
  
      } catch (err) {
        console.error(err);
        return interaction.editReply({
          content: `❌ Error occurred:\n\`\`\`${err.message}\`\`\``,
        });
      }
    },
  };
  
 
  function getTypeEmoji(type) {
    const emojiMap = {
      'Shirt': '👕',
      'Pants': '👖',
      'TShirt': '👔',
      'Hat': '🎩',
      'HairAccessory': '💇',
      'FaceAccessory': '👓',
      'NeckAccessory': '📿',
      'ShoulderAccessory': '🎒',
      'BackAccessory': '🎒',
      'WaistAccessory': '👑',
      'FrontAccessory': '🏅',
      'Gear': '⚔️',
      'Face': '😀',
      'Head': '🗿',
      'Package': '📦',
      'Animation': '💃',
      'EmoteAnimation': '🕺',
      'Audio': '🎵',
      'Decal': '🖼️',
      'Model': '🏗️',
      'Place': '🏠',
      'Badge': '🏅',
      'GamePass': '🎫'
    };
    
    return emojiMap[type] || '📄';
  }