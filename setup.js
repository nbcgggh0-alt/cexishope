const db = require('./utils/database');
const { generateId } = require('./utils/helpers');

async function setupExampleData() {
  console.log('Setting up example data...\n');
  
  const categories = [
    {
      id: generateId('CAT'),
      name: { ms: 'Streaming Premium', en: 'Premium Streaming' },
      icon: '🎬',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId('CAT'),
      name: { ms: 'Aplikasi Premium', en: 'Premium Apps' },
      icon: '📱',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId('CAT'),
      name: { ms: 'Akaun Gaming', en: 'Gaming Accounts' },
      icon: '🎮',
      createdAt: new Date().toISOString()
    }
  ];
  
  await db.saveCategories(categories);
  console.log('✅ Categories created:');
  categories.forEach(cat => {
    console.log(`   ${cat.icon} ${cat.name.ms} (${cat.id})`);
  });
  
  const exampleProducts = [
    {
      id: generateId('PROD'),
      categoryId: categories[0].id,
      name: { ms: 'Netflix Premium', en: 'Netflix Premium' },
      description: { 
        ms: 'Akaun Netflix Premium untuk 1 bulan. 4K Ultra HD, 4 peranti serentak.',
        en: 'Netflix Premium account for 1 month. 4K Ultra HD, 4 simultaneous devices.'
      },
      price: 15.00,
      stock: 5,
      active: true,
      deliveryType: 'auto',
      items: [
        'Email: netflix1@example.com | Pass: demo123',
        'Email: netflix2@example.com | Pass: demo456'
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: generateId('PROD'),
      categoryId: categories[1].id,
      name: { ms: 'CapCut Pro', en: 'CapCut Pro' },
      description: { 
        ms: 'Akaun CapCut Pro dengan semua ciri premium. 1 tahun.',
        en: 'CapCut Pro account with all premium features. 1 year.'
      },
      price: 25.00,
      stock: 10,
      active: true,
      deliveryType: 'auto',
      items: [
        'Invite Link: https://capcut.com/invite/xxx',
        'Invite Link: https://capcut.com/invite/yyy'
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: generateId('PROD'),
      categoryId: categories[1].id,
      name: { ms: 'Canva Pro', en: 'Canva Pro' },
      description: { 
        ms: 'Akses Canva Pro penuh. Semua template premium, 1TB storage.',
        en: 'Full Canva Pro access. All premium templates, 1TB storage.'
      },
      price: 20.00,
      stock: 8,
      active: true,
      deliveryType: 'manual',
      items: [],
      createdAt: new Date().toISOString()
    }
  ];
  
  await db.saveProducts(exampleProducts);
  console.log('\n✅ Example products created:');
  exampleProducts.forEach(prod => {
    console.log(`   📦 ${prod.name.ms} - RM${prod.price} (${prod.deliveryType})`);
  });
  
  console.log('\n✅ Setup complete!');
  console.log('\nNext steps:');
  console.log('1. Add your bot token to config.js');
  console.log('2. Run: npm start');
  console.log('3. Open Telegram and search for your bot');
  console.log('4. Send /start and then /setowner');
  console.log('5. Upload your payment QR to qr/ folder');
}

if (require.main === module) {
  setupExampleData().catch(console.error);
}

module.exports = { setupExampleData };
