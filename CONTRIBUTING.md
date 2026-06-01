# Contribuir a Ducker

Gracias por interesarte por Ducker.

El proyecto aún está en fase MVP, así que lo más útil ahora mismo es aportar contexto real:

- cómo levantas tus proyectos Symfony;
- qué sistema operativo usas;
- qué comandos necesitas repetir a diario;
- qué errores aparecen al arrancar backend/frontend;
- qué flujo te gustaría automatizar.

## Antes de proponer cambios

- Mantén la separación entre UI y comandos nativos.
- La UI no debe ejecutar shell directamente.
- Los comandos deben modelarse como `executable + args[] + workingDirectory`.
- Evita soluciones rígidas: los proyectos Symfony se parecen, pero no son idénticos.

## Desarrollo

```bash
npm install
npm run typecheck
npm run build
npm run tauri:dev
```

## Issues útiles

Un buen issue incluye:

- sistema operativo;
- versión de Symfony CLI si aplica;
- comando que estabas intentando ejecutar;
- ruta del proyecto si es relevante, ocultando datos privados;
- salida de error.
