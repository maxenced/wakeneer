import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

interface ProviderConfig {
  type: string;
  clientId: string;
  clientSecret: string;
  tenantId?: string;
}

interface UserProfile {
  email: string;
  displayName: string;
  provider: string;
}

export function configurePassport(providers: ProviderConfig[], callbackBaseUrl: string): void {
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: UserProfile, done) => {
    done(null, user);
  });

  for (const provider of providers) {
    switch (provider.type) {
      case 'google':
        passport.use(
          new GoogleStrategy(
            {
              clientID: provider.clientId,
              clientSecret: provider.clientSecret,
              callbackURL: `${callbackBaseUrl}/auth/google/callback`,
              scope: ['email', 'profile'],
            },
            (_accessToken, _refreshToken, profile, done) => {
              const user: UserProfile = {
                email: profile.emails?.[0]?.value ?? '',
                displayName: profile.displayName,
                provider: 'google',
              };
              done(null, user);
            },
          ),
        );
        break;
      case 'microsoft':
        import('passport-microsoft').then(({ Strategy: MicrosoftStrategy }) => {
          passport.use(
            new MicrosoftStrategy(
              {
                clientID: provider.clientId,
                clientSecret: provider.clientSecret,
                callbackURL: `${callbackBaseUrl}/auth/microsoft/callback`,
                scope: ['user.read'],
                tenant: provider.tenantId || 'common',
              },
              (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
                const user: UserProfile = {
                  email: profile.emails?.[0]?.value ?? '',
                  displayName: profile.displayName,
                  provider: 'microsoft',
                };
                done(null, user);
              },
            ),
          );
        });
        break;
      default:
        console.warn(`Unknown auth provider type: ${provider.type}`);
    }
  }
}
