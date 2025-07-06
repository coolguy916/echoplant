document.addEventListener('DOMContentLoaded', function() {
        // Get form elements
        const form = document.getElementById('login-form');
        const submitBtn = document.getElementById('submit-btn');
        const submitText = document.getElementById('submit-text');
        const submitSpinner = document.getElementById('submit-spinner');
        
        // Input elements for login
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        
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

        if (!form) {
          console.error('Login form not found');
          showError('Form initialization failed. Please refresh the page.');
          return;
        }

        // Show message function (reusable)
        function showMessage(type, message, duration = 5000) {
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
        }

        function hideAllMessages() {
          if (messageContainer) messageContainer.style.display = 'none';
          if (errorMessage) errorMessage.style.display = 'none';
          if (successMessage) successMessage.style.display = 'none';
          if (warningMessage) warningMessage.style.display = 'none';
        }

        function showError(message) {
          showMessage('error', message);
        }
        
        function showSuccess(message) {
          showMessage('success', message, 2000); // Shorter duration for success redirect
        }

        function showWarning(message) {
          showMessage('warning', message);
        }

        // Validation functions
        function validateField(input, feedbackElement, validationFn, errorMessage) {
          if (!input || !feedbackElement) return false;
          
          const isValid = validationFn(input.value.trim());
          
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
        }

        function validateEmail(email) {
          return emailPattern.test(email);
        }

        function validatePassword(password) {
          return password.length > 0; // Just check if password is not empty for login
        }

        // Real-time validation listeners
        if (emailInput) {
          emailInput.addEventListener('input', function() {
            validateField(this, document.getElementById('email-feedback'), validateEmail, 'Please enter a valid email address');
          });
        }
        if (passwordInput) {
          passwordInput.addEventListener('input', function() {
             validateField(this, document.getElementById('password-feedback'), validatePassword, 'Password cannot be empty');
          });
        }

        // Form submission
        form.addEventListener('submit', async function(e) {
          e.preventDefault();
          hideAllMessages();
          
          // Validate all fields on submit
          const isEmailValid = validateField(emailInput, document.getElementById('email-feedback'), validateEmail, 'Please enter a valid email address');
          const isPasswordValid = validateField(passwordInput, document.getElementById('password-feedback'), validatePassword, 'Password is required');

          if (!isEmailValid || !isPasswordValid) {
            showError('Please enter a valid email and password.');
            return;
          }

          // Show loading state
          if (submitBtn && submitText && submitSpinner) {
            submitBtn.disabled = true;
            submitText.textContent = 'Signing In...';
            submitSpinner.style.display = 'inline-block';
          }

          try {
            // Fetch call updated for login
            const response = await fetch('http://localhost:3001/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              // Send email and password as expected by the backend
              body: JSON.stringify({ 
                email: emailInput.value.trim(), 
                password: passwordInput.value 
              })
            });

            const result = await response.json();
            
            if (response.ok) {
              showSuccess('Login successful! Redirecting...');
              sessionStorage.setItem('loggedInUser', JSON.stringify(result.user));
              
              setTimeout(() => {
                // Redirect to your desired dashboard page
                window.location.href = '../dashboard/dashboard.html'; 
              }, 1500);

            } else {
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
              submitText.textContent = 'Sign In';
              submitSpinner.style.display = 'none';
            }
          }
        });

        // Social sign-in placeholders
        document.getElementById('google-signin')?.addEventListener('click', () => showWarning('Google sign-in is not yet implemented.'));
        document.getElementById('apple-signin')?.addEventListener('click', () => showWarning('Apple sign-in is not yet implemented.'));

        console.log('Login page initialized successfully');
      });