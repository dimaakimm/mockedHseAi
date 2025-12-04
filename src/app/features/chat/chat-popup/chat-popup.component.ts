import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserProfile } from '../../../models/user-profile.model';
import { AiApiService, PredictResult } from '../../../services/ai-api.service';

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
  @Input({ required: true }) userProfile!: UserProfile;

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
  }

  private addUserMessage(text: string): void {
    this.messages.push({
      id: this.msgId++,
      role: 'user',
      text,
      timestamp: this.nowTime(),
    });
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

  // ---------- запрос к ИИ (п.3–5) ----------

  private callModel(): void {
    if (!this.userProfile) {
      this.addBotMessage(
        'Не удалось получить данные о пользователе. Пожалуйста, заполни параметры пользователя и попробуй снова.',
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
      .subscribe((res: PredictResult) => {
        this.isWaitingForModel = false;

        const answerText = res.answer ?? 'Кажется, ответ не получен от ИИ-модели.';
        const fullText = answerText + '\n\nУдовлетворен(а) ли ты полученным ответом?';

        this.addBotMessage(fullText);
        this.stage = 'rateAnswer';
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

    this.userProfile = { ...this.userProfileDraft };
    this.userProfileChange.emit(this.userProfile);

    this.viewMode = 'chat';
    this.userProfileDraft = null;

    this.addBotMessage(
      'Параметры пользователя обновлены. Можешь задать новый вопрос или уточнить текущий.',
    );
  }

  // ---------- обратная связь ----------

  onFeedbackClick(): void {
    if (this.feedbackUrl) {
      window.open(this.feedbackUrl, '_blank');
    }
    this.feedbackClick.emit();
  }
}
