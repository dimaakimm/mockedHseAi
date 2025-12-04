// app.component.ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserProfile } from './models/user-profile.model';
import { ChatPopupComponent } from './features/chat/chat-popup/chat-popup.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ChatPopupComponent],
  template: `
    <!-- основной контент приложения -->
    <router-outlet></router-outlet>

    <!-- попап-чат прикручен к корню, живёт поверх всех страниц -->
    <app-chat-popup [userProfile]="userProfile" [feedbackUrl]="'/feedback'"></app-chat-popup>
  `,
})
export class AppComponent {
  userProfile: UserProfile = {
    // подставь реальные поля
    level: 'бакалавриат',
    campus: 'Москва',
  } as UserProfile;
}
