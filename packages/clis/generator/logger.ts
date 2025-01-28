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
        log.args = log.args.map(arg =>
          typeof arg === 'bigint'
            ? colors.yellow(`0x${arg.toString(16)}`)
            : (arg as unknown),
        );

        if (log.level === LogLevels.warn) {
          return _logger.log(colors.yellow('⚠'), ...(log.args as unknown[]));
        } else if (log.level === LogLevels.error) {
          return _logger.log(colors.red('✖'), ...(log.args as unknown[]));
        }
        _logger.log(log);
      },
    },
  ],
});
