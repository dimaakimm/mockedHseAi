import { Component, ChangeDetectionStrategy, HostListener, inject } from '@angular/core';
import { ChatWindowComponent } from '../chat-window/chat-window.component';
import { ChatStateService } from '../chat-state-service';

@Component({
  selector: 'app-chat-popup',
  standalone: true,
  imports: [ChatWindowComponent],
  templateUrl: './chat-popup.component.html',
  styleUrls: ['./chat-popup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPopupComponent {
  private state = inject(ChatStateService);
  open = false;

  toggle() {
    this.open = !this.open;
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.open = false;
  }
}
