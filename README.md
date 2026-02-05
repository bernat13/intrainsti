# Intranet / Gestor de Reservas - Guía de Adaptación

Este proyecto es una Intranet para centros educativos que permite la gestión de reservas (carros de portátiles, salas), incidencias (TIC, Mantenimiento) y eventos.

Esta guía explica **cómo adaptar este código para otro instituto**.

## 1. Configuración de Firebase

El proyecto utiliza **Firebase** (Google) para la autenticación, base de datos y alojamiento.

1.  Ve a [Firebase Console](https://console.firebase.google.com/) y crea un nuevo proyecto.
2.  Desactiva "Google Analytics" si no lo necesitas.
3.  En el panel lateral, ve a **Compilación > Authentication**.
    *   Habilita el proveedor **Google**.
4.  Ve a **Compilación > Firestore Database**.
    *   Crea una base de datos (empieza en **modo producción**).
    *   Ve a la pestaña **Reglas** y configura las reglas de seguridad (puedes copiar el archivo `firestore.rules` de este proyecto).
5.  Ve a **Configuración del Proyecto** (engranaje) > Configuración general.
    *   Registra una nueva aplicación web.
    *   Copia el objeto `firebaseConfig`.

### Archivo de Configuración
Crea o edita el archivo `js/firebase-config.js` con tus credenciales:

```javascript
// js/firebase-config.js
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
export default firebaseConfig;
```

## 2. Personalización del Código

Hay varios lugares donde el nombre del instituto y el dominio de correo están "quemados" (hardcoded). Debes cambiarlos.

### A. Dominio de Correo (`FirebaseService.js`)
El sistema valida que solo los correos corporativos del centro puedan entrar.

Busca en `js/FirebaseService.js` la función `validateUserEmail` (aprox. línea 127) y el método `login` (línea 36):

```javascript
// CAMBIAR: @iesamachado.org por tu dominio (ej: @iescervantes.es)
const domainRegex = /@iesamachado\.org$/; 
// ...
if (!user.email.endsWith('@iesamachado.org')) { ... }
```

### B. Nombre del Centro (`index.html`)
Edita `index.html` para cambiar el título de la página y los encabezados.

```html
<title>Intranet TU INSTITUTO</title>
<!-- ... -->
<a class="navbar-brand">Intranet TU INSTITUTO</a>
<!-- ... -->
<h2>Intranet TU INSTITUTO</h2>
```

## 3. Primer Inicio y Roles

El sistema tiene roles como `admin`, `equipo_tic`, `equipo_directivo`.

1.  Inicia sesión con tu cuenta de Google del dominio configurado.
2.  Al principio, serás un usuario normal.
3.  Ve a tu consola de **Firestore** > colección `users`.
4.  Busca tu documento (ID del usuario) y cambia manualmente:
    *   `isAdmin`: `true`
    *   `roles`: Agrega `['equipo_tic', 'admin']` (array).
5.  Recarga la web. Ahora verás el botón de "Admin" y podrás gestionar otros usuarios desde la interfaz.

## 4. Índices de Base de Datos
Es posible que veas errores en la consola (F12) del tipo `The query requires an index`.
Firebase requiere índices para búsquedas complejas. El mensaje de error te dará un **enlace directo** para crear el índice automáticamente. Haz clic en él y espera unos minutos.

## 5. Despliegue (Hosting)

Para subir la web a Internet:

1.  Instala Firebase Tools: `npm install -g firebase-tools`
2.  Inicia sesión: `firebase login`
3.  Inicializa el proyecto en la carpeta: `firebase init`
    *   Selecciona **Hosting**.
    *   Selecciona tu proyecto creado en el paso 1.
    *   Carpeta pública: `.` (el directorio actual, o donde estén tus html/js).
    *   Configura como SPA: `No` (o `Sí` si prefieres, pero este proyecto es simple).
4.  Despliega: `firebase deploy`

¡Listo! Tu intranet estará accesible en `https://tu-proyecto.firebaseapp.com`.
