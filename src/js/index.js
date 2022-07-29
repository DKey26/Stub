import '../components/main.scss';
import '../libs/jquery/jquery-3.3.1.min.js';
import '../libs/notify/notify.min.js';

import Parallax from '../libs/parallax/parallax.min.js';

$(document).ready(function () {
  const checkEmpty = $(".js-check-empty input");
  checkEmpty.blur(function(){                   
    if($(this).val() == '') {
      $(this).removeClass("not-empty");
    } 
    else {
      $(this).addClass("not-empty");
    }
  });

  const animatepage = $(".js-animate");
  animatepage.addClass("animate");
  
  const scene = document.getElementById("scene");
  const parallaxInstance = new Parallax(scene);
  
  const sendMailForm = $(".js-sendmail");
  const messageInstance = new Messages();
  const recaptchaInstance = new Recaptcha(messageInstance);
  const emailFormInstance = new EmailForm(sendMailForm, debounce, recaptchaInstance, messageInstance);
})

class EmailForm {
  constructor($form, debouncer, recaptchaInstance, messageInstance) {
    this.$selector = $form;
    this.debouncer = debouncer;
    this.recaptcha = recaptchaInstance;
    this.messageInstance = messageInstance;
    this.sendedEmails = [];
    this.debouncedOnSubmit = this.debouncer(this.onSubmitForm, 3000, this);
    this.loading = false;
    this.liveTimeEmailInHours = 2;

    this.initLocalStorageData();
    this.setFormStubData();
    this.addListenersOnSubmit();
  }

  /**
   * Добавление события на submit формы
   */
  addListenersOnSubmit() {
    this.$selector.submit((event) => {
      event.preventDefault();
      this.loading = true;
      this.debouncedOnSubmit();
    })
  }

  /**
   * Подготовка параметров запроса
   * @returns Объект с параметрами запроса и FormData с данными из инпутов в форме
   */
  prepareRequest() {
    const method = this.$selector.attr('method');
    const url = this.$selector.attr('action');
    const inputs = this.$selector.find('input');
    const data = new FormData();
  
    inputs.each((index, input) => {
      data.append($(input).attr('name'), input.value);
    });
  
    return {
      url,
      method,
      cache:false,
      processData:false,
      contentType:false,
      type: method,
      data
    };
  }

  /**
   * Метод для обработки данных на submit
   * @returns undefined
   */
  onSubmitForm(){
    const email = this.$selector.find('input[name="email"]')[0].value;

    if (email === '') {
      this.loading = false;
      this.messageInstance.showError('Введите, пожалуйста, ваш Email');
      return;
    }

    if(this.hasBeenSendedEmail(email) && this.isLiveEmail(email)){
      this.messageInstance.showSuccess('Ваша заявка уже отправлена!');
      this.loading = false;
      return;
    }

    this.recaptcha.executeCaptcha((token) => {
      if(!token){
        this.messageInstance.showError();
        this.loading = false;
        return;
      }
  
      const recaptchaInput = this.$selector.find('input[name="g-recaptcha-response"]');
      recaptchaInput.val(token);

      const request = this.prepareRequest(this.$selector);

      $.ajax(request)
      .done(() => {
        this.loading = false;
        this.saveSendedMail(request.data.get('email'));
        this.messageInstance.showSuccess();
      })
      .fail(() => {
        this.loading = false;
        this.messageInstance.showError();
      })
    });
  }

  /**
   * Инициализация используемых параметров в localStorage
   * @returns undefined
   */
  initLocalStorageData() {
    const emails = localStorage.getItem('emails');
    if(!emails){
      localStorage.setItem('emails', '[]');
      return;
    }
    try {
      const parsedEmails = JSON.parse(emails);
      this.sendedEmails = parsedEmails;
    }
    catch(error) {
      localStorage.setItem('emails', '[]');
    }
  }

  /**
   * Сохранение email в localStorage с параметром времени жизни
   * @param {string} email Email для сохранения в loccalStorage
   */
  saveSendedMail(email) {
    const hourMs = 1000*60*60;
    if(!this.hasBeenSendedEmail(email)) {
      this.sendedEmails.push({ name: email, liveToDate: Date.now()+hourMs*this.liveTimeEmailInHours });
      localStorage.setItem('emails', JSON.stringify(this.sendedEmails));
    }

    if(!this.isLiveEmail(email)) {
      this.sendedEmails = this.sendedEmails.filter((sendedEmail) => sendedEmail.name !== email);
      this.sendedEmails.push({ name: email, liveToDate: Date.now()+hourMs*this.liveTimeEmailInHours });
      localStorage.setItem('emails', JSON.stringify(this.sendedEmails));
    }
  }

  /**
   * Проверяет был ли этот email уже отправлен
   * @param {string} email Проверяемый email
   * @returns boolean
   */
  hasBeenSendedEmail(email) {
    const sendedEmail = this.sendedEmails.find((sendedEmail) => sendedEmail.name === email);
    if(!sendedEmail) {
      return false;
    }
    return true;
  }
  
  /**
   * Проверяет время жизни email'a
   * @param {string} email Проверяемый email
   * @returns boolean
   */
  isLiveEmail(email) {
    const sendedEmail = this.sendedEmails.find((sendedEmail) => sendedEmail.name === email);
    if(!sendedEmail) {
      return false;
    }
    if(Date.now() > sendedEmail.liveToDate){
      return false;
    }
    return true;
  }

  /**
   * Прописывает в инпуты формы фейковые данные
   */
  setFormStubData() {
    const nameInput = this.$selector.find('input[name="name"]');
    const phoneInput = this.$selector.find('input[name="phone"]');
    const siteInput = this.$selector.find('input[name="site"]');
    const sourceSectionInput = this.$selector.find('input[name="sourceSection"]');
    const licenseInput = this.$selector.find('input[name="license"]');
  
    nameInput.val('Payler Wallet');
    phoneInput.val('+79999999999');
    siteInput.val('paylerwallet.com');
    sourceSectionInput.val('payler-wallet');
    licenseInput.val('true');
  }
}

class Recaptcha {
  constructor(messageInstance) {
    this.SITE_KEY = 'SomeKey';
    this.ACTION = 'someaction';
    this.URL = 'https://www.google.com/recaptcha/api.js';
    this.messageInstance = messageInstance;

    this.addScript();
  }

  /**
   * Вызывает событие captcha с уникальным событием
   * @param {string} action Наименование события
   * @param {Function} fn Callback
   */
  callAction(action, fn) {
    if (action) {
      this.ACTION = action;
      this.executeCaptcha(fn);
    }
  }

  /**
   * Добавляет скрипт chaptcha в дом-дерево
   */
  addScript(){
    this.script = document.createElement('script');
    this.script.innerHTML = '';
    this.script.src = `${this.URL}?render=${this.SITE_KEY}`;
    this.script.async = false;
    this.script.defer = true;
    document.body.appendChild(this.script);
    this.scriptLoaded = new Promise((resolve, reject) => {
      this.script.addEventListener('load', () => {
        resolve();
      })
    })
  }

  /**
   * Вызывает событие captcha с дефолтным событием
   * @param {Function} fn Callback
   */
  executeCaptcha(fn){
    this.scriptLoaded.then(() => {
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(this.SITE_KEY, { action: this.ACTION })
          .then((token) => fn(token))
          .catch((error) => this.messageInstance.showError());
      });
    })
  }
}

class Messages {
  constructor() {
    $.notify.defaults({
      arrowShow: false,
    })
  }

  showError(message) {
    $.notify(message ? message : "Произошла ошибка, попробуйте позже", "error");
  }

  showSuccess(message) {
    $.notify(message ? message : "Email успешно отправлен", 'success');
  }
}

function debounce(fn, delay, context) {
  let timeoutID = null;
  let timeout = false;
  let breakTimeout = false;

  /** Обернутый метод с задержкой в выполнении */
  return function debounced(...args) {
    if(!context) {
      context = this;
    }
    // Заходим только при повторном вызове внутри временного интервала
    if (timeout) {

      // Обнуляем интервал времени, если метод был вызван еще раз
      breakTimeout = true;
      clearTimeout(timeoutID);

      // Выполняется лишь в последний раз, когда задержка по времени закончилась
      return new Promise((resolve) => {
        timeoutID = setTimeout(function lastApply() {
          timeout = false;
          breakTimeout = false;
          resolve(fn.apply(context, args));
        }, delay);
      });

    } else {

      // Блокируем моментальное выполнение метода, до истечения времени задержки
      timeout = true;
      setTimeout(() => {
        if (!breakTimeout) {
          timeout = false;
        }
      }, delay);

      // Выполняется лишь в первый раз
      return new Promise((resolve) => {
        resolve(fn.apply(this, args));
      });
    }
  }
}