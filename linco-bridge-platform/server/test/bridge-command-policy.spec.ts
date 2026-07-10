import { BadRequestException } from '@nestjs/common'
import { assertAllowedBridgeCommand, validateBridgeGetPath } from '../src/bridge/bridge-command-policy'

describe('bridge-command-policy', () => {
  it('allows known bridge commands', () => {
    expect(() => assertAllowedBridgeCommand('/help')).not.toThrow()
    expect(() => assertAllowedBridgeCommand('/get ./README.md')).not.toThrow()
    expect(() => assertAllowedBridgeCommand('/bind --chat abc')).not.toThrow()
    expect(() => assertAllowedBridgeCommand('/project --select "/tmp/demo"')).not.toThrow()
  })

  it('blocks arbitrary commands', () => {
    expect(() => assertAllowedBridgeCommand('/rm -rf /')).toThrow(BadRequestException)
    expect(() => assertAllowedBridgeCommand('/exec whoami')).toThrow(BadRequestException)
  })

  it('blocks dangerous get paths', () => {
    expect(() => validateBridgeGetPath('/etc/passwd; rm -rf /')).toThrow(BadRequestException)
  })
})
