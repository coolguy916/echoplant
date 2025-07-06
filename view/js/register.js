 document.addEventListener('DOMContentLoaded', function() {
        // Get form elements
        const form = document.getElementById('register-form');
        const submitBtn = document.getElementById('submit-btn');
        const submitText = document.getElementById('submit-text');
        const submitSpinner = document.getElementById('submit-spinner');
        
        // Input elements
        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        const termsCheckbox = document.getElementById('terms');
        
        // Message elements
        const messageContainer = document.getElementById('message-container');
        const errorMessage = document.getElementById('error-message');
        const successMessage = document.getElementById('success-message');
        const warningMessage = document.getElementById('warning-message');
        const errorText = document.getElementById('error-text');
        const successText = document.getElementById('success-text');
        const warningText = document.getElementById('warning-text');

        // Validation patterns
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const namePattern = /^[a-zA-Z\s]{2,50}$/;

        if (!form) {
          console.error('Registration form not found');
          showError('Form initialization failed. Please refresh the page.');
          return;
        }

        // Show message function
        function showMessage(type, message, duration = 5000) {
          try {
            hideAllMessages();
            if (messageContainer) messageContainer.style.display = 'block';
            
            switch(type) {
              case 'error':
                if (errorMessage && errorText) {
                  errorText.textContent = message;
                  errorMessage.style.display = 'block';
                }
                break;
              case 'success':
                if (successMessage && successText) {
                  successText.textContent = message;
                  successMessage.style.display = 'block';
                }
                break;
              case 'warning':
                if (warningMessage && warningText) {
                  warningText.textContent = message;
                  warningMessage.style.display = 'block';
                }
                break;
            }
            
            if (duration > 0) {
              setTimeout(hideAllMessages, duration);
            }
          } catch (error) {
            console.error('Error showing message:', error);
          }
        }

        function hideAllMessages() {
          try {
            if (messageContainer) messageContainer.style.display = 'none';
            if (errorMessage) errorMessage.style.display = 'none';
            if (successMessage) successMessage.style.display = 'none';
            if (warningMessage) warningMessage.style.display = 'none';
          } catch (error) {
            console.error('Error hiding messages:', error);
          }
        }

        function showError(message) {
          showMessage('error', message);
        }

        function showSuccess(message) {
          showMessage('success', message);
        }

        function showWarning(message) {
          showMessage('warning', message);
        }

        // Validation functions
        function validateField(input, feedbackElement, validationFn, errorMessage) {
          try {
            if (!input || !feedbackElement) return false;
            
            const value = input.type === 'checkbox' ? input.checked : input.value.trim();
            const isValid = validationFn(value);
            
            if (isValid) {
              input.classList.remove('is-invalid');
              input.classList.add('is-valid');
              feedbackElement.textContent = '';
              return true;
            } else {
              input.classList.remove('is-valid');
              input.classList.add('is-invalid');
              feedbackElement.textContent = errorMessage;
              return false;
            }
          } catch (error) {
            console.error('Validation error:', error);
            return false;
          }
        }

        function validateUsername(username) {
          return username.length >= 2 && username.length <= 50 && namePattern.test(username);
        }

        function validateEmail(email) {
          return emailPattern.test(email);
        }

        function validatePassword(password) {
          return password.length >= 6;
        }

        function validateConfirmPassword(password, confirmPassword) {
          return password === confirmPassword && password.length > 0;
        }

        function validateTerms(checked) {
          return checked;
        }

        // Real-time validation listeners
        if (usernameInput) {
          usernameInput.addEventListener('input', function() {
            validateField(this, document.getElementById('username-feedback'), validateUsername, 'Name must be 2-50 characters (letters and spaces only)');
          });
        }
        if (emailInput) {
          emailInput.addEventListener('input', function() {
            validateField(this, document.getElementById('email-feedback'), validateEmail, 'Please enter a valid email address');
          });
        }
        if (passwordInput) {
          passwordInput.addEventListener('input', function() {
            validateField(this, document.getElementById('password-feedback'), validatePassword, 'Password must be at least 6 characters long');
          });
        }
        if (confirmPasswordInput) {
          confirmPasswordInput.addEventListener('input', function() {
            const password = passwordInput ? passwordInput.value : '';
            validateField(this, document.getElementById('confirm-password-feedback'), (confirmPassword) => validateConfirmPassword(password, confirmPassword), 'Passwords do not match');
          });
        }
        if (termsCheckbox) {
          termsCheckbox.addEventListener('change', function() {
            validateField(this, document.getElementById('terms-feedback'), validateTerms, 'You must agree to the terms and policy');
          });
        }

        // Form submission
        form.addEventListener('submit', async function(e) {
          e.preventDefault();
          hideAllMessages();
          
          // Validate all fields on submit
          const isUsernameValid = validateField(usernameInput, document.getElementById('username-feedback'), validateUsername, 'Name must be 2-50 characters (letters and spaces only)');
          const isEmailValid = validateField(emailInput, document.getElementById('email-feedback'), validateEmail, 'Please enter a valid email address');
          const isPasswordValid = validateField(passwordInput, document.getElementById('password-feedback'), validatePassword, 'Password must be at least 6 characters long');
          const isConfirmPasswordValid = validateField(confirmPasswordInput, document.getElementById('confirm-password-feedback'), (val) => validateConfirmPassword(passwordInput.value, val), 'Passwords do not match');
          const areTermsValid = validateField(termsCheckbox, document.getElementById('terms-feedback'), validateTerms, 'You must agree to the terms and policy');

          const isFormValid = isUsernameValid && isEmailValid && isPasswordValid && isConfirmPasswordValid && areTermsValid;

          if (!isFormValid) {
            showError('Please correct the errors above and try again.');
            return;
          }

          // Show loading state
          if (submitBtn && submitText && submitSpinner) {
            submitBtn.disabled = true;
            submitText.textContent = 'Creating Account...';
            submitSpinner.style.display = 'inline-block';
          }

          // *** INTEGRATED BACKEND LOGIC STARTS HERE ***
          try {
            const response = await fetch('http://localhost:3001/api/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              // Send all required data from the form
              body: JSON.stringify({ 
                username: usernameInput.value.trim(),
                email: emailInput.value.trim(), 
                password: passwordInput.value 
              }) 
            });

            const result = await response.json();
            
            if (response.ok) {
              showSuccess('Account created successfully! Redirecting...');
              sessionStorage.setItem('loggedInUser', JSON.stringify(result.user));
              
              setTimeout(() => {
                window.location.href = '../dashboard/dashboard.html'; 
              }, 2000);

            } else {
              // Show error from server using the built-in message system
              showError(result.error || 'An unknown server error occurred.');
              sessionStorage.removeItem('loggedInUser');
            }
          } catch (error) {
            console.error('Fetch error:', error);
            showError('Could not connect to the API server. Please try again later.');
          } finally {
            // Reset button state regardless of outcome
            if (submitBtn && submitText && submitSpinner) {
              submitBtn.disabled = false;
              submitText.textContent = 'Signup';
              submitSpinner.style.display = 'none';
            }
          }
          // *** INTEGRATED BACKEND LOGIC ENDS HERE ***
        });

        // Social sign-in buttons (placeholder functionality)
        const googleSigninBtn = document.getElementById('google-signin');
        const appleSigninBtn = document.getElementById('apple-signin');

        if (googleSigninBtn) {
          googleSigninBtn.addEventListener('click', function() {
            showWarning('Google sign-in is not yet implemented.');
          });
        }

        if (appleSigninBtn) {
          appleSigninBtn.addEventListener('click', function() {
            showWarning('Apple sign-in is not yet implemented.');
          });
        }

        console.log('Registration page initialized successfully');
      });