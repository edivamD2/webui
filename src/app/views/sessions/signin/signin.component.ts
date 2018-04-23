import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatProgressBar, MatButton, MatSnackBar } from '@angular/material';
import { TranslateService } from '@ngx-translate/core';
import { DialogService } from '../../../services/';

import {WebSocketService} from '../../../services/ws.service';
import { DialogService } from '../../../services/dialog.service';

@Component({
  selector: 'app-signin',
  templateUrl: './signin.component.html',
  styleUrls: ['./signin.component.css']
})
export class SigninComponent implements OnInit {
  @ViewChild(MatProgressBar) progressBar: MatProgressBar;
  @ViewChild(MatButton) submitButton: MatButton;

  private failed: Boolean = false;
  private using_authenticator: Boolean = false;
  public is_freenas: Boolean = false;
  public logo_ready: Boolean = false;

  signinData = {
    username: '',
    password: ''
  }
  constructor(private ws: WebSocketService, private router: Router,
    private snackBar: MatSnackBar, public translate: TranslateService,
    private dialogService: DialogService) {
    this.ws = ws;
    this.ws.call('system.is_freenas').subscribe((res)=>{
      this.logo_ready = true;
      this.is_freenas = res;
    });
   }

  ngOnInit() {
    if (this.ws.token && this.ws.redirectUrl) {
      if (this.submitButton) {
        this.submitButton.disabled = true;
      }
      if (this.progressBar) {
        this.progressBar.mode = 'indeterminate';
      }

      this.ws.login_token(this.ws.token)
                       .subscribe((result) => { this.loginCallback(result); });
    }
  }

  connected() {
    return this.ws.connected;
  }

  signin() {
    this.using_authenticator = false;
    this.submitButton.disabled = true;
    this.progressBar.mode = 'indeterminate';

    this.ws.login(this.signinData.username, this.signinData.password)
                      .subscribe((result) => { this.loginCallback(result); });
  }

  authenticatorSignin() {
    console.log("OH BOY WE HERE");
    this.using_authenticator = true;

    this.ws.call('auth.authenticator_signin_challenge', [this.signinData.username]).subscribe((result) => {
      console.log(result);
      if (result == false) {
        this.loginCallback(false);
        return;
      }

      result.challenge = new Uint8Array(result.challenge);
      result.allowCredentials.forEach((item) => {
        item.id = new Uint8Array(item.id);
      });

      console.log(result);

      var cancelled = false;

      var dialog = this.dialogService.Operation(
        'Authenticator Sign In',
        'Please touch the blinking authenticator...',
      );
      dialog.afterClosed().subscribe(() => { cancelled = true; });

      navigator.credentials.get({publicKey: result}).then((attestation) => {
        console.log(attestation);
        console.log(cancelled);

        if (cancelled) {
          return;
        }

        dialog.close();

        this.ws.authenticatorLogin(this.signinData.username, attestation).subscribe((result) => {
          this.loginCallback(result);
        });
      }).catch((err) => {
        console.log(err);
        this.loginCallback(false);
      });
    })
  }

  loginCallback(result) {
    if (result === true) {
      this.successLogin();
    } else {
      this.errorLogin();
    }
  }

  successLogin() {
    this.ws.call('auth.generate_token', [300]).subscribe((result) => {
      if (result) {
        this.ws.token = result;

        if (this.ws.redirectUrl) {
          this.router.navigateByUrl(this.ws.redirectUrl);
          this.ws.redirectUrl = '';
        } else {
          this.router.navigate([ '/dashboard' ]);
        }
      }
    });
  }

  errorLogin() {
    this.submitButton.disabled = false;
    this.failed = true;
    this.progressBar.mode = 'determinate';
    this.signinData.password = '';
    let message = '';
    if (this.ws.token === null) {
      if (this.using_authenticator) {
        message = 'Error signing in with authenticator';
      } else {
        message = 'Username or Password is incorrect';
      }
    } else {
      message = 'Token expired, please log back in';
      this.ws.token = null;
    }
    this.translate.get('Ok').subscribe((ok: string) => {
      this.translate.get(message).subscribe((res: string) => {
        this.snackBar.open(res, ok, {duration: 4000});
      });
    });
  }

  onGoToLegacy() {
    this.translate.get('Switch to Legacy UI?').subscribe((gotolegacy: string) => {
      this.translate.get("Return to the previous graphical user interface.").subscribe((gotolegacy_prompt) => {
        this.dialogService.confirm("Switch to Legacy UI?", "Return to the previous graphical user interface.", true).subscribe((res) => {
          if (res) {
            window.location.href = '/legacy/';
          }
        });
      });
    });
  }

}
