## login card
On the login card after a user inputs their email we should keep the input but make it disabled, and also disable the button and change the subtitle to the "Check your inbox for the sign-in link, if you still can't login contact support" 
That way they know which email they sent the email to, and also to know that they should receive an email if they entered it correctly

## Gallery list

gallery list should show the thumbnail on a square, right now you identify it by name only, we can use the "marked thumbnail" or alternatively the first foto, we can create this endpoint to do that, this should be similar to the opengraph logic we have, so maybe that should be a defined endpoint in the backend to get the "thumbnail"

## Gallery management thumbnail

We should add support to mark multiple pictures so we can run operations on the seceted ones only, so as part of this work, we should, update the "delete" button to be square, move the star next to the delete button, and add a new button on the top left corner of the thumbnail to select that picture, we should also add a select all and select none button, and also consider keyboard navigation for this so we should be able to move a cursor between the pictures

# Gallery management

We need to add a confirmation modal that works when we call it, currently when we delete a picture, try to hide an album, an alert tells us to confirm the action, instead of the alert we should use the modal
And we should also add the confirmation to the "public/private" button, also check which password we use when making it private, maybe it should ask for a new password because we don't really store it in a way we can read
