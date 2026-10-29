-- Eventos de relojes (springFA100S / springS18) que faltan en CatEventos.
-- Ids fijos: los sockets ya publican 35–37 (src/common/cat-eventos.enum.ts).
-- El SOS usa 5 (Help Me) y la batería baja 3 (Battery Low).
INSERT IGNORE INTO `CatEventos` (`Id`, `Nombre`) VALUES
  (35, 'Caída'),
  (36, 'Pulsera retirada'),
  (37, 'Ritmo cardiaco anormal');
