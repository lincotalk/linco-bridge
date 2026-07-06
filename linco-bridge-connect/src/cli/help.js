function printHelp(pkg) {
  console.log(`Linco Connect ${pkg.version}

用法:
  linco-connect init --token "appId:appSecret" --agent claude [--channel linco] [--account default] [--ws-url wss://...] [--allow-insecure-ws] [--force]
  linco-connect ws-prefix gateway.example.com
  linco-connect ws-prefix --clear
  linco-connect remove-account --agent claude --account default
  linco-connect start [--daemon] [--local-im|--mock-im]
  linco-connect stop
  linco-connect reload
  linco-connect status
  linco-connect doctor

说明:
  init    初始化本地配置，不需要填写 wsUrl
  ws-prefix  按现有账号写入测试环境 wsUrl，或用 --clear 清除覆盖
  remove-account  删除指定 Agent 下的账号配置（delete-account 同义）
  start   启动本机 Agent 连接器（已运行时会先停止旧进程再启动）
  stop    停止运行中的 Linco Connect
  reload  重新读取配置文件并热重载远端 IM 连接
  status  查看 Linco Connect 是否正在运行
  doctor  检查本地运行环境

Agent:
  --agent   指定 Agent 类型，如 claude 或 codex
  --account 指定账号名，默认 default
`);
}

module.exports = {
  printHelp,
};
