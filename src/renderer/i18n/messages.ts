import type { Locale } from './index'

// Flat `namespace.key` string tables. Keep RU and EN in lockstep — every key present in one
// must exist in the other. Interpolation uses {var} placeholders resolved by translate().

const ru: Record<string, string> = {
  // common
  'common.close': 'Закрыть',
  'common.save': 'Сохранить',
  'common.reset': 'Сбросить',
  'common.cancel': 'Отмена',
  'common.back': 'Назад',
  'common.later': 'Позже',
  'common.enable': 'Включить',
  'common.disable': 'Выключить',
  'common.remove': 'Удалить',
  'common.add': 'Добавить',
  'common.loading': '…',

  // app shell
  'app.noProjects': 'Нет проектов',
  'app.addProject': 'Добавить проект',
  'app.globalClaude': 'Global Claude',
  'app.settings': 'Настройки',
  'app.showBottomPanel': 'Показать нижнюю панель',
  'app.bottomPanel': 'Нижняя панель',
  'app.resizeBottom': 'Изменить высоту нижней панели',
  'app.resizeRight': 'Изменить ширину панели',
  'app.showPanel': 'Показать панель',
  'app.hooksTitle': 'Live-агенты Claude',
  'app.hooksText':
    'OrbisDeck может показывать суб-агентов Claude в реальном времени (тип, статус), если установить два хука в ~/.claude/settings.json. Хуки лишь пишут события запуска/остановки агентов в лог — твою конфигурацию они не трогают, а выключить можно в любой момент в настройках. Без них агенты видны с задержкой.',

  // app settings modal
  'appSettings.title': 'Настройки OrbisDeck',
  'appSettings.appearance': 'Оформление',
  'appSettings.accent': 'Акцентный цвет',
  'appSettings.accentHint': 'Цвет активной вкладки и выделений во всём интерфейсе.',
  'appSettings.language': 'Язык',
  'appSettings.languageHint': 'Язык интерфейса. По умолчанию — язык системы.',
  'appSettings.about': 'О программе',
  'appSettings.aboutTagline': 'Командный центр проектов — одно окно, полный контекст.',
  'appSettings.version': 'Версия {v}',

  // project tabs
  'tabs.closeConfirm': 'Закрыть проект «{name}»? Его терминалы будут остановлены.',
  'tabs.waiting': 'Ждёт ответа',
  'tabs.working': 'Claude работает',
  'tabs.closeProject': 'Закрыть проект',
  'tabs.addProject': 'Добавить проект',

  // add-project modal
  'addProject.title': 'Новый проект',
  'addProject.nameLabel': 'Имя',
  'addProject.folderLabel': 'Папка проекта',
  'addProject.pickFolder': 'Выбрать папку…',
  'addProject.noFolder': 'папка не выбрана',
  'addProject.detected': 'Обнаружено: {sources}',
  'addProject.runLabel': 'Запуск:',
  'addProject.testLabel': 'Тесты:',
  'addProject.buildLabel': 'Сборка:',
  'addProject.detectedNote': 'Можно изменить в настройках после создания.',
  'addProject.create': 'Создать',

  // notes panel
  'notes.placeholder': 'Заметки по проекту — сохраняются автоматически…',

  // terminal panel
  'terminal.title': 'Терминал',
  'terminal.runNotSet': 'команда запуска не задана',
  'terminal.testNotSet': 'команда тестов не задана',
  'terminal.buildNotSet': 'команда сборки не задана',
  'terminal.empty': 'Нет активных терминалов',

  // right panel
  'right.tabFiles': 'Файлы',
  'right.tabAgents': 'Агенты',
  'right.tabSettings': 'Настройки',
  'right.swapSide': 'Поменять сторону панели',
  'right.collapsePanel': 'Свернуть панель',

  // docker panel
  'docker.dockerCliNotFound': 'Docker CLI не найден в PATH.',
  'docker.noComposeFile': 'В корне проекта нет docker-compose.yml / compose.yaml.',
  'docker.logsAll': 'Логи (все)',
  'docker.noContainers': 'Нет контейнеров. Нажмите «Up all» для запуска.',
  'docker.logs': 'Логи',

  // bottom panel
  'bottom.notes': 'Заметки',
  'bottom.swapWithConsole': 'Поменять местами с консолью (вверх/вниз)',
  'bottom.collapsePanel': 'Свернуть панель',

  // git panel
  'git.notARepo': 'Папка не является git-репозиторием.',
  'git.changes': 'Изменения',
  'git.staged': 'В индексе',
  'git.unstaged': 'Не в индексе',
  'git.recentCommits': 'Последние коммиты',
  'git.noCommits': 'нет коммитов',

  // diff viewer
  'diff.binaryUnavailable': 'Бинарный файл — diff недоступен',
  'diff.noChanges': 'Нет изменений',
  'diff.wholeRepo': 'весь репозиторий',
  'diff.truncated': 'diff обрезан — открой в редакторе',

  // file viewer
  'viewer.selectFile': 'Выберите файл в дереве',
  'viewer.imageTooLarge': 'Изображение слишком большое для предпросмотра ({size})',
  'viewer.binaryFile': 'Бинарный файл — просмотр недоступен',
  'viewer.truncated': 'обрезано (большой файл)',
  'viewer.viewRendered': 'Просмотр',
  'viewer.viewCode': 'Код',

  // logs modal
  'logs.refresh': 'Обновить',
  'logs.empty': '(пусто)',

  // claude panel (per-project)
  'claude.globalConfig': 'Глобальная конфигурация Claude',
  'claude.elements': 'Элементы',
  'claude.text': 'Текст',
  'claude.context': 'Контекст',
  'claude.notFound': 'CLAUDE.md не найден в этом проекте',
  'cctx.intro': 'Из чего собирается контекст Claude для проекта — сверху вниз.',
  'cctx.scopeMap': 'Карта сборки: глобал → проект (+ добавлено, Δ переопределено)',
  'cctx.scopeGlobal': 'Глобальный ~/.claude/CLAUDE.md',
  'cctx.scopeProject': 'Проект + @import-цепочка',
  'cctx.scopeSettings': 'Настройки (редактируемое)',
  'cctx.none': '— пусто —',
  'cctx.missing': 'не найден',
  'cctx.truncated': 'обрезан',
  'cctx.edit': 'Изменить',
  'cctx.permissions': 'Permissions',
  'cctx.hooks': 'Хуки',
  'cctx.mcp': 'MCP-серверы',
  'cctx.commands': 'Команды',
  'map.tab': 'Карта',
  'map.global': 'Глобально (~/.claude)',
  'map.project': 'Проект',
  'map.added': 'добавлено проектом',
  'map.override': 'переопределяет global',
  'map.hint': 'тяни узлы · колесо — зум · клик — детали',
  'claude.truncated': 'обрезано (большой файл)',

  // claude elements
  'elements.intro': '(вступление)',

  // project settings panel
  'settings.nameLabel': 'Имя проекта',
  'settings.pickFolder': 'Выбрать папку…',
  'settings.pathEmpty': 'папка не выбрана',
  'settings.path.label': 'Путь',
  'settings.path.hint': 'Корневая папка проекта. Терминалы и git/файлы работают относительно неё.',
  'settings.runCommand.label': 'Команда запуска',
  'settings.runCommand.placeholder': 'npm run dev',
  'settings.runCommand.hint': 'Что выполняет кнопка ▶ Run — открывает терминал и запускает эту команду.',
  'settings.testCommand.label': 'Тесты',
  'settings.testCommand.placeholder': 'npm test',
  'settings.testCommand.hint': 'Команда для кнопки Tests.',
  'settings.buildCommand.label': 'Сборка',
  'settings.buildCommand.placeholder': 'npm run build',
  'settings.buildCommand.hint': 'Команда для кнопки Build.',
  'settings.docsPath.label': 'Документация',
  'settings.docsPath.placeholder': 'docs/',
  'settings.docsPath.hint': 'Папка с документацией проекта (относительно корня). Пока справочно.',
  'settings.claudeMdPath.label': 'CLAUDE.md',
  'settings.claudeMdPath.placeholder': './CLAUDE.md',
  'settings.claudeMdPath.hint': 'Путь к CLAUDE.md проекта — он показывается во вкладке «Claude».',
  'settings.autoLaunchCommand.label': 'Автозапуск при открытии',
  'settings.autoLaunchCommand.placeholder': 'claude (пусто = shell)',
  'settings.autoLaunchCommand.hint': 'Команда в первом терминале при открытии проекта. Пусто — обычный shell.',
  'settings.cwdSubdir.label': 'Рабочая подпапка',
  'settings.cwdSubdir.placeholder': 'packages/app (пусто = корень)',
  'settings.cwdSubdir.hint': 'Если терминалы должны стартовать в подпапке монорепо, а не в корне.',
  'settings.envLabel': 'Переменные окружения (KEY=VALUE построчно)',
  'settings.envPlaceholder': 'API_URL=http://localhost:3000\nDEBUG=1',
  'settings.envHint':
    'Подмешиваются в окружение всех терминалов проекта. Файл .env проекта подхватывается автоматически — здесь только дополнения/переопределения.',
  'settings.runTargets.label': 'Доп. команды запуска',
  'settings.runTargets.hint':
    'Именованные команды — каждая становится кнопкой рядом с Run/Tests/Build. «Перед запуском» выполняется до основной (через &&) в том же терминале.',
  'settings.runTargets.namePlaceholder': 'имя (dev)',
  'settings.runTargets.commandPlaceholder': 'команда (npm run dev)',
  'settings.runTargets.preLaunchPlaceholder': 'перед запуском (опц., npm ci)',
  'settings.runTargets.add': 'Добавить команду',
  'settings.detect': 'Определить',
  'settings.detectTitle': 'Определить run/test/build по структуре',
  'settings.removeProject': 'Удалить проект',

  // permissions editor
  'perms.explainerBefore': 'Permissions — политика доверия агенту: что Claude может делать в виде паттернов',
  'perms.hint_allow': 'Claude делает это БЕЗ спроса (напр. Read, Bash(git status)).',
  'perms.hint_ask': 'Требует подтверждения каждый раз.',
  'perms.hint_deny': 'Запрещено полностью (напр. Bash(rm -rf*), Read(./.env)).',
  'perms.savePermissions': 'Сохранить permissions',

  // agents panel
  'agents.liveDisabled': 'Live-агенты выключены — без хуков агенты видны с задержкой (по транскрипту).',
  'agents.enableLive': 'Включить live',
  'agents.subAgentsTitle': 'Суб-агенты Claude',
  'agents.activeCount': ' · {count} активных',
  'agents.noSubAgents': 'Нет суб-агентов в активной сессии. Появятся, когда Claude запустит Task/агентов.',
  'agents.interrupted': 'Оборван',
  'agents.processesLabel': 'Процессы (терминалы)',
  'agents.noTerminals': 'Нет запущенных терминалов.',
  'agents.unitSec': 'с',
  'agents.unitMin': 'м',
  'agents.unitHour': 'ч',

  // global claude modal
  'gc.commands': 'Команды',
  'gc.skills': 'Скиллы',
  'gc.agents': 'Агенты',
  'gc.noSkills': 'Скиллы не найдены',
  'gc.noAgents': 'Агенты не найдены',
  'gc.hooksRow': 'Live-агенты (хуки в settings.json)',
  'gc.hooksOn': 'включены',
  'gc.hooksOff': 'выключены',
  'gc.notFound': '~/.claude не найден — глобальная конфигурация Claude отсутствует.',
  'gc.form': 'Форма',
  'gc.raw': 'Текст',
  'gc.noHooks': 'Хуки не настроены',
  'gc.noMcp': 'MCP-серверы не объявлены',
  'gc.noCommands': 'Нет пользовательских команд',
  'gc.elements': 'Элементы',
  'gc.text': 'Текст',
  'gc.noClaudeMd': 'Глобальный CLAUDE.md отсутствует',

  // hook-event descriptions
  'hookEvent.PreToolUse': 'Перед вызовом инструмента (можно разрешить/заблокировать). matcher — по имени инструмента.',
  'hookEvent.PostToolUse': 'После того как инструмент отработал.',
  'hookEvent.UserPromptSubmit': 'Когда ты отправляешь сообщение — до того как Claude его обработает.',
  'hookEvent.Notification': 'Когда Claude шлёт уведомление (ждёт ввода/разрешения).',
  'hookEvent.Stop': 'Когда Claude закончил ответ (ход завершён).',
  'hookEvent.SubagentStart': 'Когда запускается суб-агент (Task/Agent).',
  'hookEvent.SubagentStop': 'Когда суб-агент завершился.',
  'hookEvent.SessionStart': 'При старте сессии Claude.',
  'hookEvent.SessionEnd': 'При завершении сессии.',
  'hookEvent.PreCompact': 'Перед уплотнением контекста.',

  // claude settings form
  'claudeForm.model.label': 'Модель',
  'claudeForm.model.hint': 'Модель по умолчанию для Claude Code. Пусто — выбирает Claude Code.',
  'claudeForm.coAuthored.label': 'Co-authored-by в коммитах',
  'claudeForm.coAuthored.hint': 'Добавлять строку Co-Authored-By: Claude в создаваемые коммиты.',
  'claudeForm.cleanup.label': 'Срок хранения чатов (дней)',
  'claudeForm.cleanup.hint': 'Сколько дней хранить историю сессий перед очисткой.',
  'claudeForm.outputStyle.label': 'Стиль ответов',
  'claudeForm.outputStyle.hint': 'Тон и подробность ответов Claude.',
  'claudeForm.mcpAll.label': 'Все MCP-серверы проекта',
  'claudeForm.mcpAll.hint': 'Автоматически включать MCP-серверы из .mcp.json проекта.',
  'claudeForm.login.label': 'Метод входа',
  'claudeForm.login.hint': 'Принудительно использовать аккаунт Claude.ai или Console.',
  'claudeForm.apiKeyHelper.label': 'Скрипт API-ключа',
  'claudeForm.apiKeyHelper.hint': 'Скрипт, печатающий API-ключ/токен для аутентификации.',
  'claudeForm.missing': 'settings.json отсутствует',
  'claudeForm.notObject': 'settings.json не является объектом — откройте в режиме «Текст».',
  'claudeForm.unset': '— по умолчанию —',
  'claudeForm.otherKeys': 'Другие ключи'
}

const en: Record<string, string> = {
  // common
  'common.close': 'Close',
  'common.save': 'Save',
  'common.reset': 'Reset',
  'common.cancel': 'Cancel',
  'common.back': 'Back',
  'common.later': 'Later',
  'common.enable': 'Enable',
  'common.disable': 'Disable',
  'common.remove': 'Remove',
  'common.add': 'Add',
  'common.loading': '…',

  // app shell
  'app.noProjects': 'No projects',
  'app.addProject': 'Add project',
  'app.globalClaude': 'Global Claude',
  'app.settings': 'Settings',
  'app.showBottomPanel': 'Show bottom panel',
  'app.bottomPanel': 'Bottom panel',
  'app.resizeBottom': 'Resize bottom panel',
  'app.resizeRight': 'Resize panel',
  'app.showPanel': 'Show panel',
  'app.hooksTitle': 'Claude live agents',
  'app.hooksText':
    'OrbisDeck can show Claude sub-agents in real time (type, status) if you install two hooks into ~/.claude/settings.json. The hooks only log agent start/stop events — they never touch your config, and you can turn them off any time in settings. Without them agents appear with a delay.',

  // app settings modal
  'appSettings.title': 'OrbisDeck Settings',
  'appSettings.appearance': 'Appearance',
  'appSettings.accent': 'Accent color',
  'appSettings.accentHint': 'Color of the active tab and highlights across the UI.',
  'appSettings.language': 'Language',
  'appSettings.languageHint': 'Interface language. Defaults to your system language.',
  'appSettings.about': 'About',
  'appSettings.aboutTagline': 'Project command center — one window, full context.',
  'appSettings.version': 'Version {v}',

  // project tabs
  'tabs.closeConfirm': 'Close project "{name}"? Its terminals will be stopped.',
  'tabs.waiting': 'Waiting for response',
  'tabs.working': 'Claude is working',
  'tabs.closeProject': 'Close project',
  'tabs.addProject': 'Add project',

  // add-project modal
  'addProject.title': 'New project',
  'addProject.nameLabel': 'Name',
  'addProject.folderLabel': 'Project folder',
  'addProject.pickFolder': 'Choose folder…',
  'addProject.noFolder': 'no folder selected',
  'addProject.detected': 'Detected: {sources}',
  'addProject.runLabel': 'Run:',
  'addProject.testLabel': 'Tests:',
  'addProject.buildLabel': 'Build:',
  'addProject.detectedNote': 'You can change this in settings after creating.',
  'addProject.create': 'Create',

  // notes panel
  'notes.placeholder': 'Project notes — saved automatically…',

  // terminal panel
  'terminal.title': 'Terminal',
  'terminal.runNotSet': 'run command not set',
  'terminal.testNotSet': 'test command not set',
  'terminal.buildNotSet': 'build command not set',
  'terminal.empty': 'No active terminals',

  // right panel
  'right.tabFiles': 'Files',
  'right.tabAgents': 'Agents',
  'right.tabSettings': 'Settings',
  'right.swapSide': 'Swap panel side',
  'right.collapsePanel': 'Collapse panel',

  // docker panel
  'docker.dockerCliNotFound': 'Docker CLI not found in PATH.',
  'docker.noComposeFile': 'No docker-compose.yml / compose.yaml in the project root.',
  'docker.logsAll': 'Logs (all)',
  'docker.noContainers': 'No containers. Click "Up all" to start.',
  'docker.logs': 'Logs',

  // bottom panel
  'bottom.notes': 'Notes',
  'bottom.swapWithConsole': 'Swap with console (up/down)',
  'bottom.collapsePanel': 'Collapse panel',

  // git panel
  'git.notARepo': 'Folder is not a git repository.',
  'git.changes': 'Changes',
  'git.staged': 'Staged',
  'git.unstaged': 'Unstaged',
  'git.recentCommits': 'Recent commits',
  'git.noCommits': 'no commits',

  // diff viewer
  'diff.binaryUnavailable': 'Binary file — diff unavailable',
  'diff.noChanges': 'No changes',
  'diff.wholeRepo': 'whole repository',
  'diff.truncated': 'diff truncated — open in editor',

  // file viewer
  'viewer.selectFile': 'Select a file in the tree',
  'viewer.imageTooLarge': 'Image too large to preview ({size})',
  'viewer.binaryFile': 'Binary file — preview unavailable',
  'viewer.truncated': 'truncated (large file)',
  'viewer.viewRendered': 'Preview',
  'viewer.viewCode': 'Code',

  // logs modal
  'logs.refresh': 'Refresh',
  'logs.empty': '(empty)',

  // claude panel (per-project)
  'claude.globalConfig': 'Global Claude configuration',
  'claude.elements': 'Elements',
  'claude.text': 'Text',
  'claude.context': 'Context',
  'claude.notFound': 'CLAUDE.md not found in this project',
  'cctx.intro': 'How Claude’s context for this project is assembled — top to bottom.',
  'cctx.scopeMap': 'Assembly map: global → project (+ added, Δ overridden)',
  'cctx.scopeGlobal': 'Global ~/.claude/CLAUDE.md',
  'cctx.scopeProject': 'Project + @import chain',
  'cctx.scopeSettings': 'Settings (editable)',
  'cctx.none': '— empty —',
  'cctx.missing': 'not found',
  'cctx.truncated': 'truncated',
  'cctx.edit': 'Edit',
  'cctx.permissions': 'Permissions',
  'cctx.hooks': 'Hooks',
  'cctx.mcp': 'MCP servers',
  'cctx.commands': 'Commands',
  'map.tab': 'Map',
  'map.global': 'Global (~/.claude)',
  'map.project': 'Project',
  'map.added': 'added by project',
  'map.override': 'overrides global',
  'map.hint': 'drag nodes · wheel to zoom · click for detail',
  'claude.truncated': 'truncated (large file)',

  // claude elements
  'elements.intro': '(intro)',

  // project settings panel
  'settings.nameLabel': 'Project name',
  'settings.pickFolder': 'Choose folder…',
  'settings.pathEmpty': 'no folder selected',
  'settings.path.label': 'Path',
  'settings.path.hint': 'Project root folder. Terminals and git/files operate relative to it.',
  'settings.runCommand.label': 'Run command',
  'settings.runCommand.placeholder': 'npm run dev',
  'settings.runCommand.hint': 'What the ▶ Run button does — opens a terminal and runs this command.',
  'settings.testCommand.label': 'Tests',
  'settings.testCommand.placeholder': 'npm test',
  'settings.testCommand.hint': 'Command for the Tests button.',
  'settings.buildCommand.label': 'Build',
  'settings.buildCommand.placeholder': 'npm run build',
  'settings.buildCommand.hint': 'Command for the Build button.',
  'settings.docsPath.label': 'Documentation',
  'settings.docsPath.placeholder': 'docs/',
  'settings.docsPath.hint': 'Project documentation folder (relative to the root). For reference only for now.',
  'settings.claudeMdPath.label': 'CLAUDE.md',
  'settings.claudeMdPath.placeholder': './CLAUDE.md',
  'settings.claudeMdPath.hint': 'Path to the project’s CLAUDE.md — it is shown in the “Claude” tab.',
  'settings.autoLaunchCommand.label': 'Auto-launch on open',
  'settings.autoLaunchCommand.placeholder': 'claude (empty = shell)',
  'settings.autoLaunchCommand.hint': 'Command run in the first terminal when the project opens. Empty — a plain shell.',
  'settings.cwdSubdir.label': 'Working subfolder',
  'settings.cwdSubdir.placeholder': 'packages/app (empty = root)',
  'settings.cwdSubdir.hint': 'If terminals should start in a monorepo subfolder rather than the root.',
  'settings.envLabel': 'Environment variables (KEY=VALUE, one per line)',
  'settings.envPlaceholder': 'API_URL=http://localhost:3000\nDEBUG=1',
  'settings.envHint':
    "Merged into the environment of all project terminals. The project's .env file is picked up automatically — this is only for additions/overrides.",
  'settings.runTargets.label': 'Extra run commands',
  'settings.runTargets.hint':
    'Named commands — each becomes a button next to Run/Tests/Build. "Pre-launch" runs before the main one (chained with &&) in the same terminal.',
  'settings.runTargets.namePlaceholder': 'name (dev)',
  'settings.runTargets.commandPlaceholder': 'command (npm run dev)',
  'settings.runTargets.preLaunchPlaceholder': 'pre-launch (opt., npm ci)',
  'settings.runTargets.add': 'Add command',
  'settings.detect': 'Detect',
  'settings.detectTitle': 'Detect run/test/build from the structure',
  'settings.removeProject': 'Remove project',

  // permissions editor
  'perms.explainerBefore': 'Permissions — the agent trust policy: what Claude may do, expressed as patterns',
  'perms.hint_allow': 'Claude does this WITHOUT asking (e.g. Read, Bash(git status)).',
  'perms.hint_ask': 'Requires confirmation every time.',
  'perms.hint_deny': 'Fully forbidden (e.g. Bash(rm -rf*), Read(./.env)).',
  'perms.savePermissions': 'Save permissions',

  // agents panel
  'agents.liveDisabled': "Live agents are off — without hooks, agents show up with a delay (from the transcript).",
  'agents.enableLive': 'Enable live',
  'agents.subAgentsTitle': 'Claude sub-agents',
  'agents.activeCount': ' · {count} active',
  'agents.noSubAgents': "No sub-agents in the active session. They'll appear when Claude launches Task/agents.",
  'agents.interrupted': 'Interrupted',
  'agents.processesLabel': 'Processes (terminals)',
  'agents.noTerminals': 'No running terminals.',
  'agents.unitSec': 's',
  'agents.unitMin': 'm',
  'agents.unitHour': 'h',

  // global claude modal
  'gc.commands': 'Commands',
  'gc.skills': 'Skills',
  'gc.agents': 'Agents',
  'gc.noSkills': 'No skills found',
  'gc.noAgents': 'No agents found',
  'gc.hooksRow': 'Live agents (hooks in settings.json)',
  'gc.hooksOn': 'on',
  'gc.hooksOff': 'off',
  'gc.notFound': '~/.claude not found — no global Claude configuration.',
  'gc.form': 'Form',
  'gc.raw': 'Raw',
  'gc.noHooks': 'No hooks configured',
  'gc.noMcp': 'No MCP servers declared',
  'gc.noCommands': 'No custom commands',
  'gc.elements': 'Elements',
  'gc.text': 'Text',
  'gc.noClaudeMd': 'No global CLAUDE.md',

  // hook-event descriptions
  'hookEvent.PreToolUse': 'Before a tool runs (can allow/block). matcher — by tool name.',
  'hookEvent.PostToolUse': 'After a tool has run.',
  'hookEvent.UserPromptSubmit': 'When you submit a message — before Claude processes it.',
  'hookEvent.Notification': 'When Claude sends a notification (awaiting input/permission).',
  'hookEvent.Stop': 'When Claude finishes its reply (turn complete).',
  'hookEvent.SubagentStart': 'When a sub-agent starts (Task/Agent).',
  'hookEvent.SubagentStop': 'When a sub-agent finishes.',
  'hookEvent.SessionStart': 'When a Claude session starts.',
  'hookEvent.SessionEnd': 'When a session ends.',
  'hookEvent.PreCompact': 'Before context is compacted.',

  // claude settings form
  'claudeForm.model.label': 'Model',
  'claudeForm.model.hint': 'Default model for Claude Code. Empty — Claude Code decides.',
  'claudeForm.coAuthored.label': 'Co-authored-by in commits',
  'claudeForm.coAuthored.hint': 'Add a Co-Authored-By: Claude line to commits it makes.',
  'claudeForm.cleanup.label': 'Chat retention (days)',
  'claudeForm.cleanup.hint': 'How many days to keep session history before cleanup.',
  'claudeForm.outputStyle.label': 'Output style',
  'claudeForm.outputStyle.hint': 'Tone and verbosity of Claude’s output.',
  'claudeForm.mcpAll.label': 'All project MCP servers',
  'claudeForm.mcpAll.hint': 'Auto-enable MCP servers from the project .mcp.json.',
  'claudeForm.login.label': 'Login method',
  'claudeForm.login.hint': 'Force the Claude.ai account or Console login.',
  'claudeForm.apiKeyHelper.label': 'API key helper',
  'claudeForm.apiKeyHelper.hint': 'Script that prints an API key/token for auth.',
  'claudeForm.missing': 'settings.json is missing',
  'claudeForm.notObject': 'settings.json is not an object — open it in Raw mode.',
  'claudeForm.unset': '— default —',
  'claudeForm.otherKeys': 'Other keys'
}

export const messages: Record<Locale, Record<string, string>> = { ru, en }
