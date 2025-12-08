/**
 * firebase.ts - Configuración de Firebase Admin SDK para autenticación del backend.
 * Valida y carga credenciales desde variables de entorno con manejo de errores.
 */

import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

if (!admin.apps.length) {
  try {
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

    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      const missingVars: string[] = [];
      if (!serviceAccount.project_id) missingVars.push('FIREBASE_PROJECT_ID');
      if (!serviceAccount.client_email) missingVars.push('FIREBASE_CLIENT_EMAIL');
      if (!serviceAccount.private_key) missingVars.push('FIREBASE_PRIVATE_KEY');
      
      console.error('Variables faltantes:', missingVars.join(', '));
      throw new Error(
        `Variables de Firebase faltantes: ${missingVars.join(', ')}`
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
    });
  } catch (error) {
    console.error('Error al inicializar Firebase Admin SDK:', error);
    throw error;
  }
}

export default admin;
export const auth = admin.auth();

