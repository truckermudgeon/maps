import { createConsola, LogLevels } from 'consola';
import { colors } from 'consola/utils';

// "default" logger
const _logger = createConsola({
  formatOptions: { compact: true, colors: true, date: false },
  fancy: true,
});

// logger that overrides how WARN and ERROR messages are output by making them
// more compact (uses glyph as badge; doesn't have padding newlines).
export const logger = createConsola({
  reporters: [
    {
      log: log => {
        if (log.level === LogLevels.warn) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          return _logger.log(colors.yellow('⚠'), ...log.args);
        } else if (log.level === LogLevels.error) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          return _logger.log(colors.red('✖'), ...log.args);
        }
        _logger.log(log);
      },
    },
  ],
});
