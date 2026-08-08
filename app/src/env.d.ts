/// <reference types="vite/client" />

// Le design system est importé pour son effet de bord. TypeScript n'a rien à
// vérifier dans un fichier CSS, il a seulement besoin de savoir qu'il existe.
declare module '*.css'
