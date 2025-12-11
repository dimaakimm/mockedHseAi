import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserProfile } from '../../../models/user-profile.model';
import { AiApiService } from '../../../services/ai-api.service';

const USER_PROFILE_STORAGE_KEY = 'hseChatUserProfile';

type ChatStage =
  | 'askQuestion'
  | 'chooseCategory'
  | 'waitingModel'
  | 'rateAnswer'
  | 'afterNegative'
  | 'clarifyQuestion';

type ChatRole = 'bot' | 'user';

interface ChatMessage {
  id: number;
  role: ChatRole;
  text: string;
  timestamp?: string;
}

@Component({
  selector: 'app-chat-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-popup.component.html',
  styleUrl: './chat-popup.component.scss',
})
export class ChatPopupComponent implements OnInit {
  /** Профиль пользователя (level, campus и т.п.) */
  @ViewChild('messagesContainer')
  messagesContainer?: ElementRef<HTMLDivElement>;
  @Input({ required: true })
  userProfile!: UserProfile;
  nameError: string | null = null;

  /** Сообщаем родителю, что профиль обновлён */
  @Output() userProfileChange = new EventEmitter<UserProfile>();

  /** Ссылка на форму обратной связи (если нужно открыть внешнюю форму) */
  @Input() feedbackUrl?: string;
  @Output() feedbackClick = new EventEmitter<void>();

  isOpen = false;

  /** Текущий режим внутри попапа: чат или форма профиля */
  viewMode: 'chat' | 'profile' = 'chat';

  /** Черновик профиля для формы редактирования */
  userProfileDraft: UserProfile | null = null;

  messages: ChatMessage[] = [];
  private msgId = 1;

  stage: ChatStage = 'askQuestion';
  isWaitingForModel = false;

  currentInput = '';

  currentQuestion = '';
  currentCategory = '';
  currentSubcategory = '';
  availableSections: string[] = [];

  /** "сырые" данные классификатора (что вернул AiApiService.classify) */
  private questionFiltersRaw: any | null = null;

  private readonly categorySections: Record<string, string[]> = {
    Обучение: ['Учебный план', 'Расписание', 'Сессия и экзамены', 'Практики и стажировки'],
    Поступление: ['Приёмная комиссия', 'Документы', 'Конкурс и баллы'],
    Финансы: ['Оплата обучения', 'Стипендии', 'Льготы'],
    Другое: ['Общий вопрос'],
  };

  constructor(private aiApi: AiApiService) {}

  ngOnInit(): void {
    this.loadUserProfileFromStorage();
    this.toStartState();
  }

  // ---------- геттеры для шаблона ----------

  get inputPlaceholder(): string {
    if (this.stage === 'clarifyQuestion') {
      return 'Напиши уточнение к текущему вопросу...';
    }
    return 'Сформулируй свой вопрос по учебным процессам Вышки...';
  }

  get isInputDisabled(): boolean {
    return (
      this.viewMode === 'profile' ||
      this.stage === 'chooseCategory' ||
      this.stage === 'waitingModel' ||
      this.stage === 'rateAnswer' ||
      this.stage === 'afterNegative'
    );
  }

  private validateProfileDraft(): boolean {
    this.nameError = null;

    if (!this.userProfileDraft) {
      return true;
    }

    const raw = this.userProfileDraft.name ?? '';
    const name = raw.trim();

    // Имя необязательное, но если его ввели — должно быть не короче 3 символов
    if (name && name.length < 3) {
      this.nameError = 'Имя должно содержать не менее 3 символов.';
      return false;
    }

    return true;
  }

  // ---------- открытие / закрытие попапа ----------

  toggleOpen(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.messages.length === 0) {
      this.toStartState();
    }
  }

  close(): void {
    this.isOpen = false;
  }

  // ---------- стартовое состояние (п.1) ----------

  private toStartState(): void {
    this.viewMode = 'chat';
    this.stage = 'askQuestion';
    this.isWaitingForModel = false;
    this.currentInput = '';
    this.currentQuestion = '';
    this.currentCategory = '';
    this.currentSubcategory = '';
    this.availableSections = [];
    this.questionFiltersRaw = null;

    this.messages = [];
    this.addBotMessage(
      'Я бот, созданный для помощи по учебным процессам Вышки! Какой у тебя вопрос?',
    );
  }

  // ---------- сообщения ----------

  private addBotMessage(text: string): void {
    this.messages.push({
      id: this.msgId++,
      role: 'bot',
      text,
      timestamp: this.nowTime(),
    });

    this.scheduleScrollToBottom();
  }

  private addUserMessage(text: string): void {
    this.messages.push({
      id: this.msgId++,
      role: 'user',
      text,
      timestamp: this.nowTime(),
    });

    this.scheduleScrollToBottom();
  }

  private nowTime(): string {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ---------- отправка текста ----------

  onSubmit(): void {
    const value = this.currentInput.trim();
    if (!value || this.isInputDisabled) {
      return;
    }

    if (this.stage === 'askQuestion') {
      this.handleNewQuestion(value);
    } else if (this.stage === 'clarifyQuestion') {
      this.handleClarification(value);
    }

    this.currentInput = '';
  }

  private handleNewQuestion(question: string): void {
    this.addUserMessage(question);
    this.currentQuestion = question;
    this.callClassifier(question);
  }

  private handleClarification(clarification: string): void {
    this.addUserMessage(clarification);
    this.currentQuestion = this.currentQuestion + '\n\nУточнение пользователя: ' + clarification;
    this.callModel();
  }

  // ---------- classifier (п.1.2–2) через AiApiService ----------

  private callClassifier(question: string): void {
    this.stage = 'chooseCategory';

    this.aiApi.classify(question).subscribe((res) => {
      this.questionFiltersRaw = res;

      let category = 'Другое';

      if (res && typeof res === 'object') {
        if ('predicted_category' in res && typeof (res as any).predicted_category === 'string') {
          category = (res as any).predicted_category;
        } else if ('category' in res && typeof (res as any).category === 'string') {
          category = (res as any).category;
        }
      }

      this.currentCategory = category;
      this.availableSections = this.categorySections[category] ?? this.categorySections['Другое'];

      this.addBotMessage(`Категория твоего вопроса: ${category}. Выбери нужный раздел.`);
    });
  }

  // ---------- выбор подкатегории (п.2) ----------

  onSectionSelect(section: string): void {
    this.currentSubcategory = section;

    this.addBotMessage(
      `Категория твоего вопроса: ${this.currentCategory}. Подкатегория: ${this.currentSubcategory}.`,
    );

    this.callModel();
  }

  // ---------- парсинг FINAL ANSWER + ссылок ----------

  private extractFinalAnswerFromResponse(response: any): {
    answer: string | null;
    links: string[];
  } {
    if (!response) {
      return { answer: null, links: [] };
    }

    let raw: string | null = null;

    // Вариант 1: пришёл сырой RAG-ответ с outputs (как в твоём примере)
    if (Array.isArray(response.outputs)) {
      const answerOutput = response.outputs.find((o: any) => o && o.name === 'answer');
      if (answerOutput && answerOutput.data != null) {
        raw = String(answerOutput.data);
      }
    }

    // Вариант 2: сервис уже завернул ответ и положил строку в res.answer
    if (!raw && typeof response.answer === 'string') {
      raw = response.answer;
    }

    if (!raw) {
      return { answer: null, links: [] };
    }

    return this.extractFinalAnswerFromString(raw);
  }

  private extractFinalAnswerFromString(raw: string): { answer: string; links: string[] } {
    // Превратим "\n" в настоящие переносы строк
    const unescaped = raw.replace(/\\n/g, '\n');

    const prefix = 'FINAL ANSWER:';
    let answer = '';

    const idx = unescaped.indexOf(prefix);
    if (idx !== -1) {
      let rest = unescaped.slice(idx + prefix.length).trim();

      // В твоём формате после ответа идёт "', ['https://...']"
      const endMarker = "', [";
      const endIdx = rest.indexOf(endMarker);
      if (endIdx !== -1) {
        rest = rest.slice(0, endIdx);
      }

      // На всякий случай уберём внешние одиночные кавычки
      if (rest.startsWith("'") && rest.endsWith("'")) {
        rest = rest.slice(1, -1);
      }

      answer = rest.trim();
    } else {
      // Фоллбек: если вдруг нет FINAL ANSWER, берём всю строку
      answer = unescaped.trim();
    }

    // Вытаскиваем все URL-ы из того же текста
    const urlRegex = /https?:\/\/[^\s'"]+/g;
    const links = Array.from(new Set(unescaped.match(urlRegex) ?? []));

    return { answer, links };
  }

  // ---------- запрос к ИИ (п.3–5) ----------

  private callModel(): void {
    // тут можешь оставить свою проверку профиля как было — я не трогаю
    if (!(this.userProfile.campus && this.userProfile.level)) {
      this.addBotMessage(
        'Не удалось получить данные о пользователе (кампус и уровень образования). ' +
          'Пожалуйста, заполни параметры пользователя и попробуй снова.',
      );
      this.stage = 'askQuestion';
      this.isWaitingForModel = false;
      return;
    }

    this.stage = 'waitingModel';
    this.isWaitingForModel = true;

    this.aiApi
      .predict({
        question: this.currentQuestion,
        questionFilters: this.questionFiltersRaw ?? {},
        userProfile: this.userProfile,
        chatHistory: [],
      })
      .subscribe({
        next: (res: any) => {
          this.isWaitingForModel = false;

          // Ключевая строка – вытащим FINAL ANSWER и ссылки из того, что реально пришло
          const { answer, links } = this.extractFinalAnswerFromResponse(res);

          const parts: string[] = [];

          parts.push((answer && answer.trim()) || 'Кажется, ответ не получен от ИИ-модели.');

          if (links.length) {
            parts.push('', 'Подробнее:', links.join(', '));
          }

          parts.push('', 'Удовлетворен(а) ли ты полученным ответом?');

          const fullText = parts.join('\n');

          this.addBotMessage(fullText);
          this.stage = 'rateAnswer';
        },
        error: () => {
          this.isWaitingForModel = false;
          this.stage = 'askQuestion';
          this.addBotMessage(
            'Не получилось получить ответ от ИИ-модели. Попробуй задать вопрос ещё раз чуть позже.',
          );
        },
      });
  }

  // ---------- оценка ответа (п.6–7) ----------

  onRate(isSatisfied: boolean): void {
    if (isSatisfied) {
      this.addUserMessage('Да, удовлетворен');
      this.addBotMessage('Спасибо за оценку.');
      this.toStartState();
    } else {
      this.addUserMessage('Нет, не удовлетворен');
      this.stage = 'afterNegative';
    }
  }

  onClarifyCurrent(): void {
    this.stage = 'clarifyQuestion';
    this.addBotMessage(
      'Опиши, что именно нужно уточнить в твоём вопросе. Я передам уточнение ИИ-модели.',
    );
  }

  onAskNew(): void {
    this.addBotMessage('Спасибо за оценку.');
    this.toStartState();
  }

  // ---------- режим редактирования профиля ----------

  openProfileView(): void {
    this.viewMode = 'profile';
    this.userProfileDraft = { ...(this.userProfile ?? ({} as UserProfile)) };
  }

  onCancelProfileEdit(): void {
    this.viewMode = 'chat';
    this.userProfileDraft = null;
  }

  onSaveProfile(): void {
    if (!this.userProfileDraft) return;

    // если валидация не пройдена — остаёмся в форме профиля
    if (!this.validateProfileDraft()) {
      return;
    }

    this.userProfile = { ...this.userProfileDraft };

    this.persistUserProfileToStorage();
    this.userProfileChange.emit(this.userProfile);

    this.viewMode = 'chat';
    this.userProfileDraft = null;
    this.nameError = null;

    this.addBotMessage(
      'Параметры пользователя обновлены и сохранены. Можешь задать новый вопрос или уточнить текущий.',
    );
  }

  onNameChange(value: string): void {
    if (!this.userProfileDraft) return;
    this.userProfileDraft.name = value;
    this.validateProfileDraft();
  }

  // ---------- обратная связь ----------

  onFeedbackClick(): void {
    if (this.feedbackUrl) {
      window.open(this.feedbackUrl, '_blank');
    }
    this.feedbackClick.emit();
  }

  private scheduleScrollToBottom(): void {
    // даём Angular обновить DOM
    setTimeout(() => this.scrollToBottom(), 0);
  }

  private scrollToBottom(): void {
    if (!this.messagesContainer) return;
    const el = this.messagesContainer.nativeElement;
    el.scrollTop = el.scrollHeight;
  }

  private loadUserProfileFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as UserProfile;

      // Если в @Input уже что-то пришло — аккуратно мержим
      this.userProfile = {
        ...(this.userProfile ?? ({} as UserProfile)),
        ...parsed,
      };
    } catch (e) {
      console.warn('Не удалось прочитать профиль из localStorage', e);
    }
  }

  private persistUserProfileToStorage(): void {
    if (typeof window === 'undefined') return;
    if (!this.userProfile) return;

    try {
      const json = JSON.stringify(this.userProfile);
      window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, json);
    } catch (e) {
      console.warn('Не удалось сохранить профиль в localStorage', e);
    }
  }
}
