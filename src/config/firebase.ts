import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

// Cargar variables de entorno desde .env solo en desarrollo
// En producción (Render), las variables deben estar en el servicio o Env Group asociado
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Inicializar Firebase Admin SDK solo si no está ya inicializado
if (!admin.apps.length) {
  try {
    // Debug: mostrar qué variables están disponibles (sin valores sensibles)
    const hasProjectId = !!process.env.FIREBASE_PROJECT_ID;
    const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
    const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY;
    
    console.log('🔍 Verificando variables de Firebase:');
    console.log(`  FIREBASE_PROJECT_ID: ${hasProjectId ? '✅' : '❌'}`);
    console.log(`  FIREBASE_CLIENT_EMAIL: ${hasClientEmail ? '✅' : '❌'}`);
    console.log(`  FIREBASE_PRIVATE_KEY: ${hasPrivateKey ? '✅' : '❌'}`);
    
    if (process.env.NODE_ENV === 'production' && (!hasProjectId || !hasClientEmail || !hasPrivateKey)) {
      console.error('\n💡 IMPORTANTE: En Render, asegúrate de:');
      console.error('   1. Ir a tu servicio "final-mydw-backend-1"');
      console.error('   2. Pestaña "Environment"');
      console.error('   3. Asociar el Env Group "backend env\'s" o agregar las variables directamente');
      console.error('   4. Hacer un nuevo despliegue después de asociar las variables\n');
    }

    const serviceAccount = {
      type: process.env.FIREBASE_TYPE || 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
      token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
      universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN || 'googleapis.com'
    };

    // Verificar variables críticas
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      const missingVars: string[] = [];
      if (!serviceAccount.project_id) missingVars.push('FIREBASE_PROJECT_ID');
      if (!serviceAccount.client_email) missingVars.push('FIREBASE_CLIENT_EMAIL');
      if (!serviceAccount.private_key) missingVars.push('FIREBASE_PRIVATE_KEY');
      
      console.error('❌ Variables faltantes:', missingVars.join(', '));
      throw new Error(
        `Variables de Firebase faltantes: ${missingVars.join(', ')}`
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
    });
    
    console.log('✅ Firebase Admin SDK inicializado correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar Firebase Admin SDK:', error);
    throw error;
  }
}

// Exportar admin para uso en otras partes de la aplicación
export default admin;
export const auth = admin.auth();

