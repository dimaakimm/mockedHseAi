import {
  Component,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
  inject,
  signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { ChatStateService } from '../chat-state-service';
import { TypingIndicatorComponent } from '../../../shared/components/typing-indicator/typing-indicator.component';
import { FormsModule } from '@angular/forms';
import { ClassifierService } from '../../../core/services/classifier.service';
import { AiService } from '../../../core/services/ai.service';
import { stripHtml } from '../../../core/utils/sanitize';
import { MessageBubbleComponent } from '../../../shared/components/message-bubble/message-bubble.component';
import { ButtonListComponent } from '../../../shared/components/button-list/button-list.component';
import { AiRequest } from '../../../core/models/dto';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [
    FormsModule,
    MessageBubbleComponent,
    TypingIndicatorComponent,
    ButtonListComponent,
    ButtonComponent,
  ],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWindowComponent {
  @Output() close = new EventEmitter<void>();
  @ViewChild('chatContainer') private chatContainerRef: ElementRef | undefined;

  public state = inject(ChatStateService);
  public classifier = inject(ClassifierService);
  public ai = inject(AiService);
  public categoryOptions: Array<{ id: string; title: string }> = [];
  public rateOptions: Array<{ id: string; title: string }> | null = null;

  input = '';
  loading = signal(false);
  phase: 'greet' | 'awaitQuestion' | 'showCategory' | 'confirmSubcategory' | 'awaitAI' | 'rate' =
    'greet';

  categoriesMap: Record<string, { id: string; title: string }[]> = {
    Admissions: [
      { id: 'docs', title: 'Документы' },
      { id: 'deadlines', title: 'Сроки' },
    ],
    Finance: [
      { id: 'scholarship', title: 'Стипендии' },
      { id: 'payments', title: 'Оплаты' },
    ],
  };

  ngOnInit() {
    // Приветствие только если история пуста
    if (this.state.state().history.length === 0) {
      this.state.pushMessage(
        'bot',
        'Я бот, созданный для помощи по учебным процессам Вышки! Какой у тебя вопрос?',
      );
    }
    this.phase = 'awaitQuestion';
  }

  submitQuestion() {
    const q = stripHtml(this.input).slice(0, 2000);
    if (!q) return;

    this.state.pushMessage('user', q);
    this.state.setQuestion(q);
    this.input = '';
    this.loading.set(true);

    // Логируем вопрос перед отправкой на бэкенд
    console.log('Отправляемый вопрос на классификатор:', q);

    this.classifier.classify(q).subscribe({
      next: (res) => {
        const category = res.outputs.predicted_category || 'General';
        this.state.setCategory(category);
        this.categoryOptions = this.categoriesMap[category] || [];
        this.state.pushMessage(
          'bot',
          `Категория твоего вопроса: ${category}. Выбери нужный раздел:`,
        );
        this.loading.set(false);
        this.phase = 'showCategory';
        this.scrollToBottom();
      },
      error: () => {
        this.loading.set(false);
        this.state.pushMessage('bot', 'Не удалось определить категорию. Попробуешь ещё раз?');
        this.phase = 'awaitQuestion';
        this.scrollToBottom();
      },
    });
  }

  pickSubcategory(id: string) {
    this.state.setSubcategory(id);
    const cat = this.state.state().category!;
    const sub = (this.categoriesMap[cat] || []).find((x) => x.id === id)?.title || id;
    this.state.pushMessage('bot', `Категория твоего вопроса: ${cat}. Подкатегория: ${sub}.`);
    this.phase = 'awaitAI';
    this.scrollToBottom();
    this.askAI();
  }

  askAI() {
    const s = this.state.state();
    const questionWithContext = [...this.state.questionHistory, s.question].join(' ').trim();
    console.log('Отправляемый вопрос на ИИ:', questionWithContext);

    const payload: AiRequest = {
      inputs: [
        { name: 'question', datatype: 'str', data: questionWithContext, shape: 0 },
        { name: 'question_filters', datatype: 'str', data: JSON.stringify([s.category]), shape: 0 },
        { name: 'user_filters', datatype: 'str', data: JSON.stringify([]), shape: 0 },
        { name: 'campus_filters', datatype: 'str', data: JSON.stringify([]), shape: 0 },
        { name: 'chat_history', datatype: 'str', data: JSON.stringify({}), shape: 0 },
      ],
    };

    this.state.pushMessage('bot', 'ИИ-модель обрабатывает запрос…');
    this.loading.set(true);

    this.ai.ask(payload).subscribe({
      next: (res) => {
        // Убираем индикатор "обрабатывает"
        const history = this.state
          .state()
          .history.filter((m) => m.text !== 'ИИ-модель обрабатывает запрос…');
        this.state.state.set({ ...this.state.state(), history });
        const answer = res.outputs?.answer || 'Не удалось получить ответ.';
        this.state.pushMessage('bot', answer + '\n\nУдовлетворен(а) ли ты полученным ответом?');
        this.phase = 'rate';
        this.loading.set(false);
        this.scrollToBottom();
      },
      error: () => {
        const history = this.state
          .state()
          .history.filter((m) => m.text !== 'ИИ-модель обрабатывает запрос…');
        this.state.state.set({ ...this.state.state(), history });
        this.state.pushMessage('bot', 'Произошла ошибка при получении ответа. Попробуешь ещё раз?');
        this.phase = 'awaitQuestion';
        this.loading.set(false);
        this.scrollToBottom();
      },
    });
  }

  rateYes() {
    this.state.setSatisfaction(true);
    this.state.pushMessage('bot', 'Спасибо за оценку');
    this.scrollToBottom();
    setTimeout(() => this.restart(), 800);
  }

  rateNo() {
    this.state.setSatisfaction(false);
    this.rateOptions = [
      { id: 'clarify', title: 'Уточнить текущий вопрос' },
      { id: 'new', title: 'Задать новый вопрос' },
    ];
    this.scrollToBottom();
  }

  pickRateAction(id: string) {
    if (id === 'clarify') {
      this.state.pushMessage('bot', 'Напиши уточнение к вопросу.');
      this.phase = 'awaitQuestion';
      // Сохраняем текущий вопрос в историю для контекста
      this.state.questionHistory.push(this.state.state().question);
    } else {
      this.state.pushMessage('bot', 'Спасибо за оценку');
      setTimeout(() => this.restart(), 800);
    }
    this.rateOptions = null;
    this.scrollToBottom();
  }

  restart() {
    this.state.reset();
    this.state.questionHistory = [];
    this.phase = 'greet';
    this.rateOptions = null;
    this.ngOnInit();
  }

  private scrollToBottom() {
    if (this.chatContainerRef) {
      const container = this.chatContainerRef.nativeElement;
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 0); // Отложенный вызов чтобы DOM успел обновиться
    }
  }
}
