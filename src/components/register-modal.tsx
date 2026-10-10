"use client";

import { useState } from "react";
import { ArrowRight, LockKeyhole, UploadCloud, UserRound, X } from "lucide-react";
import { COUNTRIES, currencyForCountry } from "@/lib/countries";
import { GENDERS } from "@/lib/profile";
import { useLanguage } from "@/components/i18n-provider";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type Props = {
  onClose: () => void;
  onSwitchToLogin: () => void;
  onRegistered: () => void | Promise<void>;
};

export default function RegisterModal({ onClose, onSwitchToLogin, onRegistered }: Props) {
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Personal information
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<{ dataUrl: string; name: string } | null>(null);
  const [photoError, setPhotoError] = useState("");

  // Account setup
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const selectedCountry = COUNTRIES.find((c) => c.code === country) ?? null;

  const handlePhotoFile = (file: File | null) => {
    setPhotoError("");
    if (!file) { setPhoto(null); return; }
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) { setPhotoError(t("Upload a JPG, PNG, WEBP, or GIF image.")); return; }
    if (file.size > MAX_AVATAR_BYTES) { setPhotoError(`${t("File is too large. Max size is")} ${(MAX_AVATAR_BYTES / (1024 * 1024)).toFixed(0)}MB.`); return; }
    const reader = new FileReader();
    reader.onload = () => setPhoto({ dataUrl: String(reader.result), name: file.name });
    reader.onerror = () => setPhotoError(t("Could not read that file. Please try again."));
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || name.trim().length < 2) return setError(t("Enter your full name."));
    if (!dateOfBirth) return setError(t("Enter your date of birth."));
    if (!country) return setError(t("Select your country."));
    if (!phone.trim()) return setError(t("Enter your phone number."));
    if (!email.trim()) return setError(t("Enter your email address."));
    if (!username.trim()) return setError(t("Choose a username."));
    if (password.length < 8) return setError(t("Password must be at least 8 characters."));
    if (password !== confirmPassword) return setError(t("Password and confirm password do not match."));
    if ((securityQuestion.trim() && !securityAnswer.trim()) || (!securityQuestion.trim() && securityAnswer.trim())) {
      return setError(t("Enter both a security question and an answer, or leave both blank."));
    }
    if (!termsAccepted) return setError(t("You must agree to the Terms & Conditions."));
    if (!privacyAccepted) return setError(t("You must agree to the Privacy Policy."));

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          name: name.trim(),
          dateOfBirth,
          gender: gender || undefined,
          country,
          state: state.trim() || undefined,
          city: city.trim() || undefined,
          address: address.trim() || undefined,
          phone: phone.trim(),
          email: email.trim(),
          profilePhoto: photo?.dataUrl,
          username: username.trim(),
          password,
          confirmPassword,
          referralCode: referralCode.trim() || undefined,
          securityQuestion: securityQuestion.trim() || undefined,
          securityAnswer: securityAnswer.trim() || undefined,
          termsAccepted,
          privacyAccepted,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || t("Registration failed."));
      await onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Registration failed."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="register-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="modal-brand"><div className="brand-icon"><UserRound size={20} strokeWidth={3} /></div>{t("Create your account")}</div>
        <h2>{t("Join NexaTrade")}</h2>
        <p>{t("Your trading journey starts here. Deposit paper funds anytime to start trading. Fields marked * are required.")}</p>

        <form onSubmit={submit}>
          <div className="form-section">
            <div className="form-section-title">{t("Personal Information")}</div>
            <div className="form-grid">
              <div className="form-field"><label className="input-label">{t("Full Name")} *</label><input className="text-input" placeholder="Alex Morgan" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></div>
              <div className="form-field"><label className="input-label">{t("Date of Birth")} *</label><input className="text-input" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required /></div>
              <div className="form-field">
                <label className="input-label">{t("Gender")}</label>
                <div className="select-wrap"><select value={gender} onChange={(e) => setGender(e.target.value)}><option value="">{t("Prefer not to specify")}</option>{GENDERS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></div>
              </div>
              <div className="form-field">
                <label className="input-label">{t("Country")} *</label>
                <div className="select-wrap"><select value={country} onChange={(e) => setCountry(e.target.value)} required><option value="">{t("Select your country")}</option>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
                {selectedCountry && <p className="form-hint">{t("Your balances will display in")} {currencyForCountry(selectedCountry.code)} {t("by default — you can change this later in your profile.")}</p>}
              </div>
              <div className="form-field"><label className="input-label">{t("State/Province")}</label><input className="text-input" placeholder={t("Optional")} value={state} onChange={(e) => setState(e.target.value)} /></div>
              <div className="form-field"><label className="input-label">{t("City")}</label><input className="text-input" placeholder={t("Optional")} value={city} onChange={(e) => setCity(e.target.value)} /></div>
              <div className="form-field field-full"><label className="input-label">{t("Residential Address")}</label><input className="text-input" placeholder={t("Optional")} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              <div className="form-field"><label className="input-label">{t("Phone Number")} *</label><input className="text-input" type="tel" placeholder={selectedCountry ? `${selectedCountry.dial} ...` : "+1 555 123 4567"} value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
              <div className="form-field"><label className="input-label">{t("Email Address")} *</label><input className="text-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            </div>
            <label className="input-label">{t("Profile Photo")}</label>
            <div className="avatar-upload-row">
              <span className="avatar-preview">{photo ? <img src={photo.dataUrl} alt="Profile preview" /> : <UserRound size={26} />}</span>
              <div className="avatar-upload-actions">
                <label className="outline-btn" style={{ cursor: "pointer" }}>
                  <UploadCloud size={15} /> {photo ? t("Replace photo") : t("Upload photo")}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => handlePhotoFile(e.target.files?.[0] ?? null)} hidden />
                </label>
                {photo && <button type="button" className="outline-btn" onClick={() => setPhoto(null)}>{t("Remove")}</button>}
                <span className="form-hint">{t("Optional · JPG, PNG, WEBP, or GIF · Max 2MB · can be added later")}</span>
              </div>
            </div>
            {photoError && <p className="form-error-text">{photoError}</p>}
          </div>

          <div className="form-section">
            <div className="form-section-title">{t("Account Setup")}</div>
            <div className="form-grid">
              <div className="form-field"><label className="input-label">{t("Username")} *</label><input className="text-input" placeholder="alexmorgan" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={24} /></div>
              <div />
              <div className="form-field"><label className="input-label">{t("Password")} *</label><input className="text-input" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></div>
              <div className="form-field"><label className="input-label">{t("Confirm Password")} *</label><input className="text-input" type="password" placeholder={t("Re-enter your password")} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} /></div>
              <div className="form-field"><label className="input-label">{t("Referral/Promo Code")}</label><input className="text-input" placeholder={t("Optional")} value={referralCode} onChange={(e) => setReferralCode(e.target.value)} /></div>
              <div />
              <div className="form-field"><label className="input-label">{t("Security Question")}</label><input className="text-input" placeholder={t("Optional — e.g. favorite teacher's name")} value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)} /></div>
              <div className="form-field"><label className="input-label">{t("Security Answer")}</label><input className="text-input" placeholder={t("Optional")} value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} /></div>
            </div>
            <p className="form-hint">{t("Setting a security question lets you reset your password later without email access.")}</p>
          </div>

          <div className="register-checkboxes">
            <label className="checkbox-row"><input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} required /> {t("I agree to the")} <a href="#" onClick={(e) => e.preventDefault()}>{t("Terms & Conditions")}</a> *</label>
            <label className="checkbox-row"><input type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} required /> {t("I agree to the")} <a href="#" onClick={(e) => e.preventDefault()}>{t("Privacy Policy")}</a> *</label>
          </div>

          {error && <p className="form-error-text">{error}</p>}
          <button className="primary-btn full-btn" disabled={submitting}>{submitting ? t("Creating account...") : t("Create account")}<ArrowRight size={17} /></button>
        </form>
        <div className="modal-switch">{t("Already have an account?")} <button onClick={onSwitchToLogin}>{t("Sign in")}</button></div>
        <div className="modal-security"><LockKeyhole size={14} /> {t("Your account is secured with encrypted credentials")}</div>
      </div>
    </div>
  );
}
