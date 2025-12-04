import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserProfile } from './models/user-profile.model';
import { UserProfileService } from './services/user-profile.service';
import { UserProfileFormComponent } from './components/user-profile-form/user-profile-form.component';
import { AiApiService } from './services/ai-api.service';
import { ChatWindowComponent } from './features/chat/chat-window/chat-window.component';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [CommonModule, UserProfileFormComponent, ChatWindowComponent, RouterOutlet],
})
export class AppComponent implements OnInit {
  showProfile = false;
  userProfile: UserProfile | null = null;

  constructor(private userProfileService: UserProfileService) {}

  ngOnInit(): void {
    this.userProfileService.profile$.subscribe((profile) => {
      this.userProfile = profile;
    });
  }

  toggleProfile(): void {
    this.showProfile = !this.showProfile;
  }

  onProfileSaved(profile: UserProfile): void {
    // Профиль уже сохранён через сервис, но можно что-то ещё сделать
    this.showProfile = false;
  }
}
