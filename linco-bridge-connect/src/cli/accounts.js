const {
  getConfigFile,
  readUserConfig,
  removeConfiguredAccount,
  saveUserConfig,
} = require('../config');

function removeAccountCommand(options) {
  const configFile = getConfigFile();
  const current = readUserConfig(configFile);
  const result = removeConfiguredAccount(current, {
    account: options.account,
    agent: options.agent,
    channel: options.channel,
  });

  saveUserConfig(result.config, configFile);

  console.log(`已删除账号: ${result.channelName}/${result.agentType}/${result.account}`);
  if (result.agentDefaultAccount) {
    console.log(`当前 ${result.agentType} 默认账号: ${result.agentDefaultAccount}`);
  }
  if (result.defaultAgent) {
    console.log(`当前默认 Agent: ${result.defaultAgent}`);
  }
  console.log(`配置文件: ${configFile}`);
}

module.exports = {
  removeAccountCommand,
};
