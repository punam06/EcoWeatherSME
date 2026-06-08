import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update handleSubmit to handle forgot password
    # Look for:
    #             if (mode === "login") {
    #               result = await sb.auth.signInWithPassword({ email, password });
    #             } else {
    
    auth_handler = """            if (mode === "login") {
              result = await sb.auth.signInWithPassword({ email, password });
            } else if (mode === "register") {
              result = await sb.auth.signUp({
                email,
                password,
                options: {
                  data: { name, role: backendRole }
                }
              });
            } else if (mode === "forgot") {
              result = await sb.auth.resetPasswordForEmail(email);
              if (!result.error) {
                setIsSuccess(true);
                setSuccessMsg("Reset link sent to your email!");
                setTimeout(() => {
                  setMode("login");
                  setIsSuccess(false);
                }, 2500);
                setIsLoading(false);
                return;
              }
            }"""

    target_regex_1 = r'            if \(mode === "login"\) \{\s*result = await sb\.auth\.signInWithPassword\(\{ email, password \}\);\s*\} else \{\s*result = await sb\.auth\.signUp\(\{\s*email,\s*password,\s*options: \{\s*data: \{ name, role: backendRole \}\s*\}\s*\}\);\s*\}'
    content = re.sub(target_regex_1, auth_handler, content)


    # 2. Add an explicit check for mode === "forgot" where password validation happens:
    #           if (mode === "register" && password !== confirmPassword) {
    #             setError("Passwords do not match");
    #             setIsLoading(false);
    #             return;
    #           }
    pass_validation = """          if (mode === "register" && password !== confirmPassword) {
            setError("Passwords do not match");
            setIsLoading(false);
            return;
          }
          if (mode === "forgot" && !email) {
            setError("Please enter your email address");
            setIsLoading(false);
            return;
          }"""
    content = content.replace('          if (mode === "register" && password !== confirmPassword) {\n            setError("Passwords do not match");\n            setIsLoading(false);\n            return;\n          }', pass_validation)


    # 3. Update the JSX form to render conditionally based on mode === "forgot"
    # For password field:
    #                     <div style={formStyles.inputGroup}>
    #                       <input required type={showPass ? "text" : "password"} ...
    # Wait, we need to hide password, confirmPassword, name, etc. if mode is "forgot"
    # Let's wrap password with {mode !== "forgot" && ( ... )}
    
    password_group_regex = r'(\s*<div style=\{formStyles\.inputGroup\}>\s*<input required type=\{showPass \? "text" : "password"\} className="auth-input-focus" [^>]+>\s*<label[^>]+>Password</label>.*?</div>\s*)(<div style=\{\{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" \}\}>)'

    def password_repl(m):
        return f'\n                    {{mode !== "forgot" && (\n                      <>\n{m.group(1)}                      </>\n                    )}}\n{m.group(2)}'

    content = re.sub(password_group_regex, password_repl, content, flags=re.DOTALL)

    # Wrap the "Remember me" and "Forgot password" with mode !== "forgot"
    remember_me_regex = r'(\s*<div style=\{\{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" \}\}>.*?<a href="#" style=\{\{[^}]+\}\}>(Forgot password\?)</a>\s*</div>\s*)'
    def forgot_repl(m):
        # We need to add an onClick to the forgot password link
        original = m.group(1)
        original_with_onclick = original.replace('<a href="#"', '<a href="#" onClick={(e) => { e.preventDefault(); setMode("forgot"); }}')
        return f'\n                    {{mode !== "forgot" && (\n{original_with_onclick}\n                    )}}\n'

    content = re.sub(remember_me_regex, forgot_repl, content, flags=re.DOTALL)

    # Change submit button text
    submit_btn_regex = r'(\) : "Sign In"\})'
    content = re.sub(submit_btn_regex, r') : mode === "forgot" ? "Send Reset Link" : mode === "register" ? "Create Account" : "Sign In"}', content)

    # If it's mode forgot, we might want a "Back to login" link
    back_to_login = """
                    {mode === "forgot" && (
                      <div style={{ textAlign: "center", marginBottom: "24px", marginTop: "-10px" }}>
                        <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); }} style={{ color: "#10B981", fontSize: "13px", textDecoration: "none", fontFamily: "Inter" }}>Back to Login</a>
                      </div>
                    )}
"""
    content = content.replace('                    {error && mode === "login" &&', back_to_login + '                    {error &&')
    # Let's fix the error display to not be restricted to login
    content = content.replace('{error && mode === "login" &&', '{error &&')
    content = content.replace('className={error && mode === "login" ? "auth-error-shake" : ""}', 'className={error ? "auth-error-shake" : ""}')

    # In register mode, it uses "Sign In" button logic from before. It was just `{isLoading ? ... : isSuccess ? ... : "Sign In"}`. So the button text update fixes that.

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r"d:\user_jabu\hackathon-ev\Frontend and UI\climalogix_dashboard.jsx")
process_file(r"d:\user_jabu\hackathon-ev\Frontend and UI\index.html")
print("Done")
