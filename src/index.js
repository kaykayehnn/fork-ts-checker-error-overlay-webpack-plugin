const typescriptFormatter = require('react-dev-utils/typescriptFormatter')

const PLUGIN_NAME = 'ForkTsCheckerErrorOverlayPlugin'

class ForkTsCheckerErrorOverlayPlugin {
  constructor(forkTsCheckerWebpackPlugin) {
    this._forkTsCheckerWebpackPlugin = forkTsCheckerWebpackPlugin
  }

  apply(compiler) {
    if (compiler.options.mode !== 'development') return

    let tsMessagesPromise
    let tsMessagesResolver
    let devSocket

    compiler.hooks.afterResolvers.tap(PLUGIN_NAME, ({ options }) => {
      if (compiler.options.devServer) {
        const originalBefore = options.devServer.before

        options.devServer.before = (app, server) => {
          if (originalBefore) {
            originalBefore(app, server)
          }

          devSocket = {
            warnings: warnings => devServer.sockWrite(server.sockets, 'warnings', warnings),
            errors: errors => server.sockWrite(server.sockets, 'errors', errors),
          }
        }
      }
    })

    compiler.hooks.beforeCompile.tap(PLUGIN_NAME, () => {
      tsMessagesPromise = new Promise(resolve => {
        tsMessagesResolver = msgs => resolve(msgs)
      })
    })

    this._forkTsCheckerWebpackPlugin
      .getCompilerHooks(compiler)
      .receive.tap(PLUGIN_NAME, (diagnostics, lints) => {
        const allMsgs = [...diagnostics, ...lints]
        const format = message => `${message.file}\n${typescriptFormatter(message, true)}`

        tsMessagesResolver({
          errors: allMsgs.filter(msg => msg.severity === 'error').map(format),
          warnings: allMsgs.filter(msg => msg.severity === 'warning').map(format),
        })
      })

    compiler.hooks.done.tap(PLUGIN_NAME, async stats => {
      const statsData = stats.toJson({
        all: false,
        warnings: true,
        errors: true,
      })

      if (statsData.errors.length === 0) {
        const messages = await tsMessagesPromise

        // Push errors and warnings into compilation result
        // to show them after page refresh triggered by user.
        stats.compilation.errors.push(...messages.errors)
        stats.compilation.warnings.push(...messages.warnings)

        if (messages.errors.length > 0) {
          devSocket.errors(messages.errors)
        } else if (messages.warnings.length > 0) {
          devSocket.warnings(messages.warnings)
        }
      }
    })
  }
}

module.exports = ForkTsCheckerErrorOverlayPlugin
