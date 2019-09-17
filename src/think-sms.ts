// @ts-ignore
import { think } from 'thinkjs'
import Core from '@alicloud/pop-core'

export interface IConf {
  accessKeyId?: string,
  accessKeySecret?: string,
  endpoint?: string,
  apiVersion?: string,
  sendEnv?: string,
  signName?: string,
  logDb?: string,
  logTable?: string,
  templates?: {
    login: string
    join: string,
    reset: string,
    [key: string]: string
  }
}

export interface ISendOpt {
  PhoneNumbers: string | number
  SignName?: string,
  TemplateCode: string | number,
  TemplateParam?: string,
  SmsUpExtendCode?: string | number,
  OutId?: string | number,
}

export interface ISendCode {
  phone: string | number,
  template: string | number,
  code: string | number,
  signName?: string,
  outId?: string | number,
  extendCode?: string | number
}

export default class extends think.Service {
  conf: IConf
  client: Core

  constructor(conf?: IConf) {
    super()
    const dfOpts = {
      accessKeyId: '',
      accessKeySecret: '',
      endpoint: 'https://dysmsapi.aliyuncs.com',
      apiVersion: '2017-05-25',
      sendEnv: 'prod',
      signName: '',
      templates: {
        login: '',
        join: '',
        reset: ''
      }
    }
    const dfConf = think.config('sms')
    this.conf = Object.assign(dfOpts, dfConf, conf)
    const { accessKeyId = '', accessKeySecret = '', endpoint = '', apiVersion = '' } = this.conf
    this.client = new Core({
      accessKeyId,
      accessKeySecret,
      endpoint,
      apiVersion
    });
  }

  async send(opts: ISendOpt) {
    opts.SignName = opts.SignName || this.conf.signName
    const isSend = think.env === this.conf.sendEnv
    let code = 0
    let msg = ''
    let data: any = {}
    if (isSend) {
      const requestOption = {
        method: 'POST'
      }
      await this.client.request('SendSms', opts, requestOption).then((result: any) => {
        data = result
      }, (e) => {
        code = 1
        think.logger.error(e)
        data = e.data
        msg = e.message
      })
    } else {
      think.logger.info(JSON.stringify(opts))
    }
    const { RequestId: requestId = '', BizId: bizId = '' } = data
    const sendLog = {
      code,
      msg,
      requestId,
      bizId,
      data: JSON.stringify(data),
      phone: opts.PhoneNumbers,
      sign: opts.SignName,
      template: opts.TemplateCode,
      params: opts.TemplateParam,
      time: Math.floor(new Date().getTime() / 1000)
    }
    const { logTable, logDb } = this.conf
    if (logTable && logDb) {
      think.model(logTable, logDb).add(sendLog)
    }
    return { code, msg, data }
  }

  sendCode({ phone, template, code, signName = this.conf.signName, outId = '', extendCode = '' }: ISendCode) {
    const templateCode = this.conf.templates && this.conf.templates[template]
    if (!templateCode) {
      return { code: 403003, msg: '找不到对应的短信模板' }
    }
    const opts: ISendOpt = {
      SignName: signName,
      TemplateCode: templateCode,
      PhoneNumbers: phone,
      TemplateParam: JSON.stringify({ code }),
      OutId: outId,
      SmsUpExtendCode: extendCode
    }
    return this.send(opts)
  }
}
