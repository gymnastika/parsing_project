# Google OAuth Verification Video Script
# Скрипт для видео верификации Google OAuth

**Duration / Длительность:** 4-5 minutes / 4-5 минут  
**Language / Язык:** English with subtitles / Английский с субтитрами

---

## SECTION 1: Introduction (0:00 - 0:45)
## РАЗДЕЛ 1: Введение (0:00 - 0:45)

### What to show on screen:
- Open Google Cloud Console
- Navigate to OAuth consent screen
- Show the OAuth Client ID

### Что показать на экране:
- Открыть Google Cloud Console
- Перейти в OAuth consent screen
- Показать OAuth Client ID

### Script to say:

**English:**
```
Hello, this is a demonstration video for the GYMNASTIKA Parsing Platform OAuth application. 

My name is [your name], and I will show you how our application uses Google OAuth scopes to provide functionality to our users.

First, let me show you our OAuth Client ID in the Google Cloud Console. As you can see here, the Client ID is [read the client ID from screen].

Our application homepage is https://parsing-production-4bd5.up.railway.app

Now let me demonstrate how users authorize our application and how we use each requested scope.
```

**Russian / Русский:**
```
Здравствуйте, это демонстрационное видео для OAuth приложения GYMNASTIKA Parsing Platform.

Меня зовут [ваше имя], и я покажу вам, как наше приложение использует области доступа Google OAuth для предоставления функциональности нашим пользователям.

Сначала позвольте мне показать наш OAuth Client ID в Google Cloud Console. Как вы можете видеть здесь, Client ID это [прочитать client ID с экрана].

Домашняя страница нашего приложения https://parsing-production-4bd5.up.railway.app

Теперь позвольте мне продемонстрировать, как пользователи авторизуют наше приложение и как мы используем каждую запрашиваемую область доступа.
```

---

## SECTION 2: OAuth Authorization Flow (0:45 - 2:00)
## РАЗДЕЛ 2: Процесс OAuth авторизации (0:45 - 2:00)

### What to show on screen:
1. Open your application: https://parsing-production-4bd5.up.railway.app
2. Click "Настройки" (Settings) in the left menu
3. Click "Подключить Google аккаунт" (Connect Google Account) button
4. Show the Google OAuth consent screen that appears
5. Point to each scope being requested
6. Click "Allow" / "Разрешить"
7. Show successful connection confirmation

### Что показать на экране:
1. Открыть ваше приложение: https://parsing-production-4bd5.up.railway.app
2. Нажать "Настройки" в левом меню
3. Нажать кнопку "Подключить Google аккаунт"
4. Показать появившийся экран согласия Google OAuth
5. Указать на каждую запрашиваемую область доступа
6. Нажать "Allow" / "Разрешить"
7. Показать подтверждение успешного подключения

### Script to say:

**English:**
```
Now I will demonstrate the OAuth authorization flow from a user's perspective.

I'm opening the GYMNASTIKA Parsing Platform application. As you can see, this is the main dashboard.

I'm clicking on Settings in the left menu, and now I'm clicking the "Connect Google Account" button.

This opens the Google OAuth consent screen. As you can see, our application is requesting the following permissions:

1. Send emails on your behalf - this is the gmail.send scope
2. View your email address - this is userinfo.email scope  
3. See your personal info - this is userinfo.profile scope
4. See and download files from your Google Drive - this is drive.readonly scope
5. Add files to your Google Drive - this is drive.file scope

I will click "Allow" to grant these permissions.

And now you can see the connection was successful - the status shows "Google account connected" with my email address displayed.
```

**Russian / Русский:**
```
Сейчас я продемонстрирую процесс OAuth авторизации с точки зрения пользователя.

Я открываю приложение GYMNASTIKA Parsing Platform. Как вы видите, это главная панель управления.

Я нажимаю на Настройки в левом меню, и теперь нажимаю кнопку "Подключить Google аккаунт".

Это открывает экран согласия Google OAuth. Как вы видите, наше приложение запрашивает следующие разрешения:

1. Отправлять письма от вашего имени - это область gmail.send
2. Просматривать ваш email адрес - это область userinfo.email
3. Видеть вашу личную информацию - это область userinfo.profile  
4. Просматривать и загружать файлы из вашего Google Drive - это область drive.readonly
5. Добавлять файлы в ваш Google Drive - это область drive.file

Я нажму "Разрешить" чтобы предоставить эти разрешения.

И теперь вы видите подключение прошло успешно - статус показывает "Google аккаунт подключен" с отображением моего email адреса.
```

---

## SECTION 3: Gmail Send Scope Usage (2:00 - 3:15)
## РАЗДЕЛ 3: Использование области Gmail Send (2:00 - 3:15)

### What to show on screen:
1. Click "Email" section in left menu
2. Show the email campaign interface
3. Click "Создать рассылку" (Create campaign) button
4. Fill in email subject: "Test Campaign for OAuth Demo"
5. Write email body: "This is a test email to demonstrate gmail.send scope usage"
6. Show contact selection (select 2-3 test contacts)
7. Click "Отправить" (Send) button
8. Show sending progress
9. Show success confirmation

### Что показать на экране:
1. Нажать раздел "Email" в левом меню
2. Показать интерфейс email кампании
3. Нажать кнопку "Создать рассылку"
4. Заполнить тему письма: "Test Campaign for OAuth Demo"
5. Написать текст письма: "This is a test email to demonstrate gmail.send scope usage"
6. Показать выбор контактов (выбрать 2-3 тестовых контакта)
7. Нажать кнопку "Отправить"
8. Показать прогресс отправки
9. Показать подтверждение успеха

### Script to say:

**English:**
```
Now let me demonstrate how we use the gmail.send scope to send email campaigns.

I'm clicking on the Email section in the left menu. This is where users can create and send email campaigns to their business contacts.

I'm clicking "Create Campaign" to start a new email campaign.

Now I'm filling in the email details:
- Subject: "Test Campaign for OAuth Demo"  
- Body: "This is a test email to demonstrate gmail.send scope usage"

Now I need to select recipients. I'm choosing a few test contacts from the contact database.

As you can see, I've selected 3 contacts to receive this email.

Now I'm clicking the Send button.

The application is now using the gmail.send scope to send these emails through the Gmail API on behalf of the authenticated user.

You can see the sending progress - email 1 of 3, email 2 of 3, email 3 of 3.

And here's the success confirmation - all 3 emails have been sent successfully using the user's Gmail account.

This is how we use the gmail.send scope - strictly for sending email campaigns that users explicitly create and approve.
```

**Russian / Русский:**
```
Теперь позвольте продемонстрировать, как мы используем область gmail.send для отправки email кампаний.

Я нажимаю на раздел Email в левом меню. Здесь пользователи могут создавать и отправлять email кампании своим бизнес-контактам.

Я нажимаю "Создать рассылку" чтобы начать новую email кампанию.

Теперь я заполняю детали письма:
- Тема: "Test Campaign for OAuth Demo"
- Текст: "This is a test email to demonstrate gmail.send scope usage"

Теперь мне нужно выбрать получателей. Я выбираю несколько тестовых контактов из базы контактов.

Как вы видите, я выбрал 3 контакта для получения этого письма.

Теперь я нажимаю кнопку Отправить.

Приложение сейчас использует область gmail.send чтобы отправить эти письма через Gmail API от имени авторизованного пользователя.

Вы можете видеть прогресс отправки - письмо 1 из 3, письмо 2 из 3, письмо 3 из 3.

И вот подтверждение успеха - все 3 письма были успешно отправлены используя Gmail аккаунт пользователя.

Вот как мы используем область gmail.send - строго для отправки email кампаний, которые пользователи явно создают и одобряют.
```

---

## SECTION 4: Google Drive Scopes Usage (3:15 - 4:30)
## РАЗДЕЛ 4: Использование областей Google Drive (3:15 - 4:30)

### What to show on screen:
1. Go back to Email section
2. Click "Создать рассылку" again
3. Click "Добавить вложение" (Add attachment)
4. Select a file LARGER than 25MB (prepare this beforehand!)
5. Show the upload progress to Google Drive
6. Show the file appears as attachment with Google Drive icon
7. Optionally: Show the file in Google Drive (open Drive in new tab)
8. Complete the email and show it's ready to send with Drive attachment

### Что показать на экране:
1. Вернуться в раздел Email
2. Нажать "Создать рассылку" снова
3. Нажать "Добавить вложение"
4. Выбрать файл БОЛЬШЕ 25MB (приготовить заранее!)
5. Показать прогресс загрузки в Google Drive
6. Показать что файл появился как вложение с иконкой Google Drive
7. Опционально: Показать файл в Google Drive (открыть Drive в новой вкладке)
8. Завершить письмо и показать что оно готово к отправке с вложением из Drive

### Script to say:

**English:**
```
Now let me demonstrate how we use the Google Drive scopes - drive.file and drive.readonly.

I'm going back to the Email section to create another campaign, but this time with a large file attachment.

I'm clicking "Add Attachment" to upload a file.

As you can see, I'm selecting a file that is 30 megabytes in size. Gmail has a 25 megabyte attachment limit, so our application needs to use Google Drive for larger files.

Watch what happens: the application is now uploading this file to the user's Google Drive using the drive.file scope.

You can see the upload progress - 25%, 50%, 75%, 100%.

The file has been successfully uploaded to Google Drive and is now attached to this email.

Notice the Google Drive icon next to the attachment - this indicates the file is stored in Google Drive.

Let me open Google Drive in a new tab to verify. As you can see, the file appears here in a folder called "GYMNASTIKA Email Attachments" - this was created by our application using the drive.file scope.

When this email is sent, the application will use the drive.readonly scope to read this file from Google Drive and attach it to the email.

This is the only reason we need Drive scopes - to handle email attachments that exceed Gmail's 25MB limit. We only upload files that users explicitly select as email attachments, and we only read files that our application previously uploaded.
```

**Russian / Русский:**
```
Теперь позвольте продемонстрировать, как мы используем области Google Drive - drive.file и drive.readonly.

Я возвращаюсь в раздел Email чтобы создать еще одну кампанию, но на этот раз с большим файлом-вложением.

Я нажимаю "Добавить вложение" чтобы загрузить файл.

Как вы видите, я выбираю файл размером 30 мегабайт. Gmail имеет лимит вложений в 25 мегабайт, поэтому нашему приложению нужно использовать Google Drive для больших файлов.

Смотрите что происходит: приложение сейчас загружает этот файл в Google Drive пользователя используя область drive.file.

Вы видите прогресс загрузки - 25%, 50%, 75%, 100%.

Файл был успешно загружен в Google Drive и теперь прикреплен к этому письму.

Обратите внимание на иконку Google Drive рядом с вложением - это указывает что файл хранится в Google Drive.

Позвольте открыть Google Drive в новой вкладке для проверки. Как вы видите, файл появляется здесь в папке "GYMNASTIKA Email Attachments" - она была создана нашим приложением используя область drive.file.

Когда это письмо будет отправлено, приложение будет использовать область drive.readonly чтобы прочитать этот файл из Google Drive и прикрепить его к письму.

Это единственная причина, по которой нам нужны области Drive - для обработки вложений email, которые превышают лимит Gmail в 25MB. Мы загружаем только файлы, которые пользователи явно выбирают как вложения email, и мы читаем только файлы, которые наше приложение ранее загрузило.
```

---

## SECTION 5: Privacy & Security (4:30 - 5:00)
## РАЗДЕЛ 5: Конфиденциальность и безопасность (4:30 - 5:00)

### What to show on screen:
1. Open Privacy Policy page in new tab: https://parsing-production-4bd5.up.railway.app/privacy.html
2. Scroll to show "Google API Services" section
3. Open Terms of Service page: https://parsing-production-4bd5.up.railway.app/terms.html
4. Scroll to show "Google Services Integration" section
5. Show OAuth Client ID one more time in Google Cloud Console

### Что показать на экране:
1. Открыть страницу Privacy Policy в новой вкладке: https://parsing-production-4bd5.up.railway.app/privacy.html
2. Прокрутить чтобы показать раздел "Google API Services"
3. Открыть страницу Terms of Service: https://parsing-production-4bd5.up.railway.app/terms.html
4. Прокрутить чтобы показать раздел "Google Services Integration"
5. Показать OAuth Client ID еще раз в Google Cloud Console

### Script to say:

**English:**
```
Finally, let me show you our Privacy Policy and Terms of Service, which explain to users how we handle their data.

Here is our Privacy Policy at /privacy.html. As you can see in the "Google API Services" section, we clearly explain:
- We do NOT store Google Account passwords
- We only use the minimal scopes necessary for functionality
- Users can revoke access at any time through Google Account settings
- We do NOT share data with third parties
- All OAuth tokens are stored encrypted in our secure database

And here is our Terms of Service at /terms.html. The "Google Services Integration" section clearly states that users are responsible for emails they send, and they must comply with Google's Terms of Service.

To summarize:
- Our OAuth Client ID is [read from screen]
- We use gmail.send scope ONLY for sending user-initiated email campaigns
- We use drive.file and drive.readonly scopes ONLY for email attachments larger than 25MB
- We have comprehensive Privacy Policy and Terms of Service
- All user data is protected and users maintain full control

Thank you for watching this demonstration. If you have any questions about our OAuth implementation, please refer to our documentation or contact us at support@gymnastika.ae
```

**Russian / Русский:**
```
Наконец, позвольте показать вам нашу Политику конфиденциальности и Условия использования, которые объясняют пользователям как мы обрабатываем их данные.

Вот наша Политика конфиденциальности на /privacy.html. Как вы видите в разделе "Google API Services", мы четко объясняем:
- Мы НЕ храним пароли от Google Account
- Мы используем только минимальные области доступа необходимые для функциональности
- Пользователи могут отозвать доступ в любое время через настройки Google Account
- Мы НЕ передаем данные третьим лицам
- Все OAuth токены хранятся в зашифрованном виде в нашей защищенной базе данных

И вот наши Условия использования на /terms.html. Раздел "Google Services Integration" четко указывает что пользователи несут ответственность за отправляемые письма, и они должны соблюдать Условия использования Google.

Подводя итог:
- Наш OAuth Client ID это [прочитать с экрана]
- Мы используем область gmail.send ТОЛЬКО для отправки email кампаний инициированных пользователем
- Мы используем области drive.file и drive.readonly ТОЛЬКО для вложений email больше 25MB
- У нас есть полная Политика конфиденциальности и Условия использования
- Все данные пользователей защищены и пользователи сохраняют полный контроль

Спасибо за просмотр этой демонстрации. Если у вас есть вопросы о нашей реализации OAuth, пожалуйста обратитесь к нашей документации или свяжитесь с нами по адресу support@gymnastika.ae
```

---

## TECHNICAL CHECKLIST / ТЕХНИЧЕСКИЙ ЧЕКЛИСТ

### Before Recording / Перед записью:
- [ ] Prepare a file >25MB for Drive upload demo
- [ ] Create 2-3 test contacts in database
- [ ] Clear browser cache and logout from Google
- [ ] Test full OAuth flow once to ensure it works
- [ ] Prepare screen recording software (OBS, QuickTime, etc.)

### Подготовить файл >25MB для демонстрации загрузки в Drive
### Создать 2-3 тестовых контакта в базе данных
### Очистить кэш браузера и выйти из Google
### Протестировать полный OAuth процесс один раз чтобы убедиться что работает
### Подготовить ПО для записи экрана (OBS, QuickTime, и т.д.)

### During Recording / Во время записи:
- [ ] Speak clearly and slowly in English
- [ ] Show OAuth Client ID clearly (zoom in if needed)
- [ ] Point mouse cursor at important UI elements
- [ ] Show full URLs in browser address bar
- [ ] Pause 2-3 seconds between sections

### Говорить четко и медленно на английском
### Показать OAuth Client ID четко (увеличить если нужно)
### Указывать курсором мыши на важные элементы UI
### Показывать полные URL в адресной строке браузера
### Делать паузу 2-3 секунды между разделами

### After Recording / После записи:
- [ ] Upload to YouTube (unlisted or public)
- [ ] Add English subtitles if possible
- [ ] Copy YouTube link
- [ ] Submit link in Google OAuth verification form

### Загрузить на YouTube (unlisted или public)
### Добавить английские субтитры если возможно
### Скопировать ссылку на YouTube
### Отправить ссылку в форме верификации Google OAuth

---

## TIPS FOR SUCCESS / СОВЕТЫ ДЛЯ УСПЕХА

✅ **DO / ДЕЛАТЬ:**
- Record in 1080p or higher resolution
- Use a clean browser profile without extensions
- Show the full application URL in address bar
- Demonstrate REAL functionality, not mockups
- Explain WHY each scope is needed

✅ **Записывать в 1080p или выше разрешении**
✅ **Использовать чистый профиль браузера без расширений**
✅ **Показывать полный URL приложения в адресной строке**
✅ **Демонстрировать РЕАЛЬНУЮ функциональность, не макеты**
✅ **Объяснять ЗАЧЕМ нужна каждая область доступа**

❌ **DON'T / НЕ ДЕЛАТЬ:**
- Don't rush - speak slowly and clearly
- Don't skip showing OAuth Client ID
- Don't use fake data or mockups
- Don't forget to show Privacy Policy and Terms
- Don't record with poor audio quality

❌ **Не спешить - говорить медленно и четко**
❌ **Не пропускать показ OAuth Client ID**
❌ **Не использовать поддельные данные или макеты**
❌ **Не забывать показывать Privacy Policy и Terms**
❌ **Не записывать с плохим качеством звука**

---

## VIDEO UPLOAD INSTRUCTIONS / ИНСТРУКЦИИ ПО ЗАГРУЗКЕ ВИДЕО

### YouTube Settings / Настройки YouTube:

**Title / Название:**
```
GYMNASTIKA Parsing Platform - Google OAuth Scope Demonstration
```

**Description / Описание:**
```
This video demonstrates how GYMNASTIKA Parsing Platform uses Google OAuth scopes for user functionality.

OAuth Client ID: [your client ID]
Application URL: https://parsing-production-4bd5.up.railway.app

Scopes demonstrated:
- gmail.send - Sending email campaigns
- drive.file - Uploading large email attachments  
- drive.readonly - Reading attachments from Drive
- userinfo.email - User identification
- userinfo.profile - User profile data

Privacy Policy: https://parsing-production-4bd5.up.railway.app/privacy.html
Terms of Service: https://parsing-production-4bd5.up.railway.app/terms.html

For questions: support@gymnastika.ae
```

**Visibility / Видимость:**
- Unlisted (для верификации достаточно unlisted)

**Category / Категория:**
- Science & Technology

---

## FINAL NOTES / ФИНАЛЬНЫЕ ЗАМЕТКИ

После загрузки видео на YouTube:

1. Скопируйте ссылку на видео
2. Вернитесь в Google Cloud Console → OAuth consent screen
3. Нажмите "Submit for verification"
4. В форме верификации вставьте ссылку на YouTube видео
5. Заполните остальные поля формы
6. Submit

Обычно Google проверяет заявки в течение 3-7 рабочих дней.

После одобрения ваше приложение будет работать для всех пользователей без "unverified app" warning.

Удачи с записью видео! 🎥
